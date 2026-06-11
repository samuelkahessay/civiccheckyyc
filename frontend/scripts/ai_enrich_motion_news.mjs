#!/usr/bin/env node
/*
  Enrich motions with related news articles.
  - Selects recent motions
  - Builds search queries
  - Fetches articles (Bing News / NewsAPI / Google News RSS)
  - Optionally uses OpenAI to re-rank and summarize relevance
  - Upserts into public.motion_articles (see scripts/README_AI.md for SQL)

  Usage:
    node scripts/ai_enrich_motion_news.mjs [--days 30] [--limit 25] [--per-motion 3] [--provider bing|newsapi|rss]

  Env:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    OPENAI_API_KEY (optional for relevance/summaries)
    BING_NEWS_API_KEY or NEWSAPI_KEY depending on provider
*/

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

function loadLocalEnv() {
  try {
    const envPath = path.resolve(process.cwd(), 'scripts/.env.scripts')
    if (fs.existsSync(envPath)) {
      const txt = fs.readFileSync(envPath, 'utf8')
      txt.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (m) {
          const key = m[1]
          let val = m[2]
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
            val = val.slice(1, -1)
          }
          if (!(key in process.env)) process.env[key] = val
        }
      })
    }
  } catch (_) {}
}
loadLocalEnv()

const args = new Map()
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) {
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true']
    args.set(k, v)
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See scripts/.env.scripts.example')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const DAYS = parseInt(args.get('days') || process.env.MOTION_LOOKBACK_DAYS || '30', 10)
const LIMIT = parseInt(args.get('limit') || '25', 10)
const PER_MOTION = parseInt(args.get('per-motion') || process.env.ARTICLES_PER_MOTION || '3', 10)
const PROVIDER = (args.get('provider') || process.env.PROVIDER || 'bing').toLowerCase()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const BING_KEY = process.env.BING_NEWS_API_KEY || ''
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || ''

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function buildQuery(motion) {
  // Prefer precise identifiers; fall back to summary keywords
  const rn = Array.isArray(motion.report_numbers) && motion.report_numbers.length
    ? motion.report_numbers.join(' OR ')
    : ''
  const dateYear = motion.meeting_date ? new Date(motion.meeting_date).getFullYear() : ''
  const base = `Calgary City Council ${dateYear}`
  if (rn) {
    return `${base} (${rn})`
  }
  const summaryBits = (motion.motion_summary || motion.resolution || '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 12)
    .join(' ')
  return `${base} ${summaryBits}`
}

async function fetchBing(query) {
  if (!BING_KEY) return []
  const url = new URL('https://api.bing.microsoft.com/v7.0/news/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '10')
  url.searchParams.set('freshness', 'Month')
  url.searchParams.set('setLang', 'en-CA')
  url.searchParams.set('cc', 'CA')
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': BING_KEY }
  })
  if (!res.ok) return []
  const j = await res.json()
  return (j.value || []).map(item => ({
    title: item.name,
    url: item.url,
    source: item.provider?.[0]?.name || null,
    publishedAt: item.datePublished || null,
    description: item.description || null,
  }))
}

async function fetchNewsApi(query) {
  if (!NEWSAPI_KEY) return []
  const url = new URL('https://newsapi.org/v2/everything')
  url.searchParams.set('q', query)
  url.searchParams.set('language', 'en')
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('pageSize', '10')
  const res = await fetch(url, {
    headers: { 'X-Api-Key': NEWSAPI_KEY }
  })
  if (!res.ok) return []
  const j = await res.json()
  return (j.articles || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source?.name || null,
    publishedAt: a.publishedAt || null,
    description: a.description || null,
  }))
}

async function fetchRss(query) {
  const url = new URL('https://news.google.com/rss/search')
  url.searchParams.set('q', query)
  url.searchParams.set('hl', 'en-CA')
  url.searchParams.set('gl', 'CA')
  url.searchParams.set('ceid', 'CA:en')
  const res = await fetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  // Very naive RSS parser for common fields (title, link, pubDate, source)
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml))) {
    const itemXml = m[1]
    const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1] ||
                  (itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || null
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || null
    const pub = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || null
    const source = (itemXml.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || null
    items.push({ title, url: link, source, publishedAt: pub, description: null })
  }
  return items
}

async function reRankWithOpenAI(motion, articles) {
  if (!OPENAI_API_KEY) return articles.map(a => ({ ...a, relevance_score: null, ai_summary: null, sentiment: null }))
  const system = `You rate news article relevance to a City Council motion. Return compact JSON array of objects with keys: relevance (0..1), summary (≤ 30 words), sentiment (positive|neutral|negative).` 
  const user = JSON.stringify({
    motion: {
      summary: motion.motion_summary,
      resolution: motion.resolution?.slice(0, 800),
      meeting_date: motion.meeting_date,
      report_numbers: motion.report_numbers || [],
      topic: motion.topic,
    },
    articles: articles.map(a => ({ title: a.title, description: a.description }))
  })
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]})
  })
  if (!res.ok) return articles.map(a => ({ ...a, relevance_score: null, ai_summary: null, sentiment: null }))
  const data = await res.json()
  let payload = {}
  try {
    payload = JSON.parse(data?.choices?.[0]?.message?.content || '{}')
  } catch (_) {}
  const ratings = Array.isArray(payload?.ratings) ? payload.ratings : []
  return articles.map((a, i) => ({
    ...a,
    relevance_score: (ratings[i]?.relevance ?? null),
    ai_summary: ratings[i]?.summary ?? null,
    sentiment: ratings[i]?.sentiment ?? null,
  }))
}

async function upsertArticles(motionId, searchQuery, articles) {
  const rows = articles.map(a => ({
    motion_id: motionId,
    title: a.title,
    url: a.url,
    source: a.source,
    published_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
    description: a.description,
    relevance_score: a.relevance_score ?? null,
    sentiment: a.sentiment ?? null,
    ai_summary: a.ai_summary ?? null,
    ai_highlights: null,
    search_query: searchQuery,
  }))
  const { error } = await supabase.from('motion_articles').upsert(rows, { onConflict: 'motion_id,url' })
  if (error) throw error
}

async function selectRecentMotions(days, limit) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('motions')
    .select('id, motion_summary, resolution, meeting_date, report_numbers, topic')
    .gte('meeting_date', cutoff)
    .order('meeting_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

async function fetchArticles(provider, query) {
  if (provider === 'bing') return await fetchBing(query)
  if (provider === 'newsapi') return await fetchNewsApi(query)
  if (provider === 'rss') return await fetchRss(query)
  return []
}

async function main() {
  console.log(`\n=== AI News Enrichment for Motions ===`)
  console.log(`Provider: ${PROVIDER} | Days: ${DAYS} | Motions: ${LIMIT} | Max articles/motion: ${PER_MOTION}`)
  if (PROVIDER === 'bing' && !BING_KEY) console.log('Note: BING_NEWS_API_KEY not set — results will be empty.')
  if (PROVIDER === 'newsapi' && !NEWSAPI_KEY) console.log('Note: NEWSAPI_KEY not set — results will be empty.')
  if (PROVIDER === 'rss') console.log('Using Google News RSS (no API key).')

  const motions = await selectRecentMotions(DAYS, LIMIT)
  if (!motions.length) {
    console.log('No motions found for the selected window.')
    return
  }

  let totalInserted = 0
  for (const m of motions) {
    const q = buildQuery(m)
    console.log(`\n→ Motion ${m.id}  ${new Date(m.meeting_date).toISOString().slice(0,10)}  query: ${q}`)
    try {
      let articles = await fetchArticles(PROVIDER, q)
      if (!articles.length) {
        console.log('   (no articles found)')
        continue
      }
      // Basic dedupe by URL
      const seen = new Set()
      articles = articles.filter(a => a.url && !seen.has(a.url) && seen.add(a.url))

      // Optional re-ranking with OpenAI
      articles = await reRankWithOpenAI(m, articles)

      // Sort by relevance then recency
      articles.sort((a, b) => (Number(b.relevance_score || 0) - Number(a.relevance_score || 0)) || (new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)))
      const top = articles.slice(0, PER_MOTION)

      await upsertArticles(m.id, q, top)
      totalInserted += top.length
      console.log(`   ✓ upserted ${top.length} article(s)`)    
    } catch (e) {
      console.error('   ✗ error', e?.message || e)
    }
    await sleep(250)
  }

  console.log(`\nDone. Upserted ~${totalInserted} articles total.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

