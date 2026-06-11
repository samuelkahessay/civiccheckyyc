#!/usr/bin/env node
/*
  Backfill motion summaries, topic, and impact using OpenAI.
  - Reads motions from Supabase where any of (motion_summary, topic, impact) is NULL (default)
  - Uses OpenAI to produce concise summary, a normalized topic, and impact level
  - Writes updates back to Supabase

  Usage:
    node scripts/ai_backfill_motion_summaries.mjs [--limit 50] [--only-missing] [--force]

  Env:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_MODEL
    Optionally place them in scripts/.env.scripts and the loader will read it.
*/

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

// Lightweight .env loader for scripts/.env.scripts
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
          // Remove surrounding quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
            val = val.slice(1, -1)
          }
          if (!(key in process.env)) process.env[key] = val
        }
      })
    }
  } catch (_) {
    // ignore
  }
}

loadLocalEnv()

// Basic CLI args
const args = new Map()
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) {
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true']
    args.set(k, v)
  }
}

const LIMIT = parseInt(args.get('limit') || '50', 10)
const ONLY_MISSING = args.has('force') ? false : true

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See scripts/.env.scripts.example')
  process.exit(1)
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY. See scripts/.env.scripts.example')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TOPIC_TAXONOMY = [
  'Budget & Finance',
  'Taxes & Fees',
  'Housing & Zoning',
  'Transit',
  'Transportation',
  'Public Safety',
  'Environment & Climate',
  'Infrastructure',
  'Parks & Recreation',
  'Economic Development',
  'Governance',
  'Procurement',
  'Planning & Policy',
  'Community Services',
]

function promptForResolution(resolution, context) {
  return [
    {
      role: 'system',
      content: `You are assisting a civic transparency app for Calgary city council. 
Return a concise, neutral, plain-language summary, classify topic using a closed taxonomy, and assess impact.
Respond ONLY as compact JSON with keys: motion_summary, topic, impact.
Constraints:
- motion_summary: max 2 sentences, ≤ 60 words, no jargon.
- topic: choose EXACTLY one from: ${TOPIC_TAXONOMY.join(', ')}.
- impact: one of: high | medium | low.
` },
    {
      role: 'user',
      content: JSON.stringify({
        resolution,
        meeting_date: context.meeting_date,
        meeting_type: context.meeting_type,
        existing: {
          topic: context.topic,
          impact: context.impact,
        },
      }),
    },
  ]
}

async function openaiChat(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return content
}

function parseJsonLoose(text) {
  // Strip code fences if present
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    throw new Error('Failed to parse JSON from model response')
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function selectMotions(limit, onlyMissing) {
  let query = supabase
    .from('motions')
    .select('id, resolution, meeting_date, meeting_type, motion_summary, topic, impact')
    .order('meeting_date', { ascending: false })
    .limit(limit)

  if (onlyMissing) {
    query = query.or('motion_summary.is.null,topic.is.null,impact.is.null')
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function updateMotion(motionId, patch) {
  const { error } = await supabase
    .from('motions')
    .update(patch)
    .eq('id', motionId)
  if (error) throw error
}

async function main() {
  console.log('\n=== AI Backfill: motions.motion_summary/topic/impact ===')
  console.log(`Model: ${OPENAI_MODEL}`)
  console.log(`Limit: ${LIMIT} | Only missing: ${ONLY_MISSING}`)

  const motions = await selectMotions(LIMIT, ONLY_MISSING)
  if (!motions.length) {
    console.log('No candidate motions found. Use --force or increase --limit.')
    return
  }

  let updated = 0
  for (const m of motions) {
    const needs = {
      summary: !m.motion_summary,
      topic: !m.topic,
      impact: !m.impact,
    }
    if (!needs.summary && !needs.topic && !needs.impact && ONLY_MISSING) {
      continue
    }

    console.log(`\n→ ${m.id} ${m.meeting_date}  ${m.motion_summary ? '(' + m.motion_summary.slice(0,50) + '...)' : ''}`)
    try {
      const messages = promptForResolution(m.resolution, m)
      const raw = await openaiChat(messages)
      const json = parseJsonLoose(raw)

      const patch = {
        motion_summary: json.motion_summary?.trim()?.slice(0, 400) || m.motion_summary,
        topic: TOPIC_TAXONOMY.includes(json.topic) ? json.topic : (m.topic || null),
        impact: ['high','medium','low'].includes((json.impact||'').toLowerCase()) ? json.impact.toLowerCase() : (m.impact || null),
      }

      await updateMotion(m.id, patch)
      updated += 1
      console.log('   ✓ updated', patch)
    } catch (e) {
      console.error('   ✗ error', e?.message || e)
    }

    // Gentle pacing
    await sleep(250)
  }

  console.log(`\nDone. Updated ${updated}/${motions.length} motions.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

