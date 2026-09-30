import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface Candidate {
  id: string
  name: string
  slug: string
  current_role: string | null
  photo_url: string | null
  website: string | null
  wikipedia_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
  ai_ballot_brief?: any | null
  ai_topic_stances?: Record<string, any> | null
  ai_position_vector?: any | null
}

export interface Motion {
  id: string
  resolution: string
  motion_summary: string | null
  meeting_date: string
  meeting_url: string | null
  meeting_type: string | null
  topic: string | null
  impact: 'high' | 'medium' | 'low' | null
  report_numbers: string[] | null
  calendar_event_url: string | null
  agenda_url: string | null
  minutes_url: string | null
  source_dataset_id: string | null
  source_api_url: string | null
  source_portal_url: string | null
  created_at: string
  updated_at: string
  // Whole-council outcome from the source dataset; votes below cover tracked candidates only.
  council_result: 'Carried' | 'Defeated' | null
  council_for: number | null
  council_against: number | null
  council_absent: number | null
}

export interface Vote {
  id: string
  candidate_id: string
  motion_id: string | null
  motion_title: string
  motion_summary: string | null
  vote: 'for' | 'against' | 'absent'
  meeting_date: string
  meeting_url: string | null
  meeting_type: string | null
  topic: string | null
  impact: 'high' | 'medium' | 'low' | null
  confidence: 'ai_generated' | 'under_review' | 'verified'
  ai_extraction_notes: string | null
  verified_by: string | null
  verified_at: string | null
  source_text: string | null
  report_numbers: string[] | null
  data_source_row_id: string | null
  created_at: string
  updated_at: string
  source_dataset_id: string | null
  source_row_id: string | null
  source_api_url: string | null
  source_portal_url: string | null
  source_hash: string | null
  calendar_event_url: string | null
  agenda_url: string | null
  minutes_url: string | null
  fetched_at: string | null
  processed_at: string | null
  prompt_version: string | null
  model_version: string | null
  ai_response_tokens: number | null
}

export interface AiBallotBrief {
  brief: string
  strengths: string[]
  tradeoffs: string[]
  top_votes: { title: string; why_it_matters?: string; citations: any[] }[]
  citations: any[]
  insufficient_evidence?: boolean
}

export type AiTopicStances = Record<string, {
  topic: string
  stance: string
  evidence_votes: { title: string; rationale?: string; citations: any[] }[]
  confidence: number
  coverage: number
  citations: any[]
  insufficient_evidence?: boolean
}>

export interface AiPositionVector {
  axes?: Record<string, number | null>
  topic_scores: Record<string, number>
  consistency: number
}

export interface MotionExplainer {
  eli5: string
  why_it_matters: string
  key_impacts: string[]
  citations: any[]
}

export interface PairwiseBrief {
  candidate_a_slug: string
  candidate_b_slug: string
  data: {
    agree: string[]
    disagree: string[]
    notable_agreement: string
    meaningful_contrast: string
    citations: any[]
    insufficient_evidence?: boolean
  }
}

export interface CandidateWithStats {
  candidate: Candidate
  voteCount: number
  topTopics: { topic: string; count: number }[]
}

export interface CandidateComparisonData {
  candidate: Candidate
  votes: Vote[]
  voteCount: number
  forCount: number
  againstCount: number
  absentCount: number
  highImpactCount: number
  topicBreakdown: { topic: string; count: number; for: number; against: number }[]
}

export interface VoteWithCandidate extends Vote {
  candidates: Candidate
}

export interface PlatformStance {
  id: string
  candidate_id: string
  campaign_page_id: string | null
  topic: string | null
  title: string
  stance_summary: string | null
  quote: string
  source_url: string
  source_scroll_url: string | null
  confidence: 'ai_generated' | 'under_review' | 'verified'
  created_at: string
  updated_at: string
}

export interface OverlappingVote {
  motion_title: string
  meeting_date: string
  meeting_url: string | null
  topic: string | null
  impact: 'high' | 'medium' | 'low' | null
  motion_summary: string | null
  votes: {
    candidate_id: string
    candidate_name: string
    vote: 'for' | 'against' | 'absent'
  }[]
  agreement_type: 'all_agree' | 'all_disagree' | 'mixed'
}

export interface MotionWithVotes extends Motion {
  votes: Array<{
    id: string
    candidate_id: string
    vote: 'for' | 'against' | 'absent'
    candidates: Candidate
  }>
}

export interface VoteWithMotion extends Vote {
  motions: Motion | null
}

// The app runs from frontend/ locally and from the deployment root on Vercel.
const appDir = fs.existsSync(path.join(process.cwd(), 'data', 'local-seed.sql'))
  ? process.cwd()
  : path.join(process.cwd(), 'frontend')
const seedPath = path.join(appDir, 'data', 'local-seed.sql')
// Vercel's project directory is read-only at runtime, so the database lives
// in the temp dir there and is re-seeded on cold start.
const dbDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'civiccheckyyc')
  : path.join(appDir, '.local')
const dbPath = process.env.CIVICCHECK_LOCAL_DB || path.join(dbDir, 'civiccheckyyc-v2.sqlite')

let dbInstance: Database.Database | null = null

function db() {
  if (dbInstance) return dbInstance
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  dbInstance = new Database(dbPath)
  dbInstance.pragma('foreign_keys = ON')

  const hasTables = dbInstance.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'candidates'"
  ).get()

  if (!hasTables) {
    dbInstance.exec(fs.readFileSync(seedPath, 'utf8'))
  }

  return dbInstance
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapCandidate(row: any): Candidate {
  return {
    ...row,
    ai_ballot_brief: parseJson(row.ai_ballot_brief, null),
    ai_topic_stances: parseJson(row.ai_topic_stances, null),
    ai_position_vector: parseJson(row.ai_position_vector, null),
  }
}

function mapMotion(row: any): Motion {
  return {
    ...row,
    report_numbers: parseJson<string[] | null>(row.report_numbers, null),
  }
}

function mapVote(row: any): Vote {
  return {
    ...row,
    report_numbers: parseJson<string[] | null>(row.report_numbers, null),
    ai_response_tokens: row.ai_response_tokens ?? null,
  }
}

function candidates() {
  return db().prepare('SELECT * FROM candidates ORDER BY name').all().map(mapCandidate)
}

function motions() {
  return db().prepare('SELECT * FROM motions ORDER BY meeting_date DESC').all().map(mapMotion)
}

function votes() {
  return db().prepare('SELECT * FROM votes ORDER BY meeting_date DESC').all().map(mapVote)
}

function candidateById() {
  return new Map(candidates().map(candidate => [candidate.id, candidate]))
}

function withVotes(motion: Motion): MotionWithVotes {
  const byCandidate = candidateById()
  return {
    ...motion,
    votes: votes()
      .filter(vote => vote.motion_id === motion.id)
      .map(vote => ({
        id: vote.id,
        candidate_id: vote.candidate_id,
        vote: vote.vote,
        candidates: byCandidate.get(vote.candidate_id)!,
      }))
      .filter(vote => vote.candidates),
  }
}

function topTopicsFor(candidateId: string, limit = 3) {
  const counts = new Map<string, number>()
  for (const vote of votes().filter(vote => vote.candidate_id === candidateId)) {
    if (vote.topic) counts.set(vote.topic, (counts.get(vote.topic) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function matchesQuery(text: string | null | undefined, q?: string) {
  if (!q || q.trim().length === 0) return true
  return String(text || '').toLowerCase().includes(q.trim().toLowerCase())
}

export async function getCandidates() {
  return candidates()
}

export async function getCandidateBySlug(slug: string) {
  const candidate = candidates().find(candidate => candidate.slug === slug)
  if (!candidate) throw new Error(`Candidate not found: ${slug}`)
  return candidate
}

export async function getVotesByCandidate(candidateId: string) {
  return votes().filter(vote => vote.candidate_id === candidateId)
}

export async function getVoteCount(candidateId: string): Promise<number> {
  return votes().filter(vote => vote.candidate_id === candidateId).length
}

export async function getAggregateStats() {
  const allVotes = votes()
  const allMotions = motions()
  const dates = allMotions.map(motion => motion.meeting_date).sort()
  return {
    totalVotes: allVotes.length,
    totalMotions: allMotions.length,
    highImpactCount: allMotions.filter(motion => motion.impact === 'high').length,
    activeCandidates: new Set(allVotes.map(vote => vote.candidate_id)).size,
    dateRange: {
      earliest: dates[0] || null,
      latest: dates[dates.length - 1] || null,
    },
  }
}

export async function getTopicStats() {
  const topicMap = new Map<string, { count: number; candidates: Set<string> }>()
  for (const vote of votes()) {
    if (!vote.topic) continue
    if (!topicMap.has(vote.topic)) topicMap.set(vote.topic, { count: 0, candidates: new Set() })
    const stats = topicMap.get(vote.topic)!
    stats.count++
    stats.candidates.add(vote.candidate_id)
  }
  return Array.from(topicMap.entries())
    .map(([topic, stats]) => ({ topic, voteCount: stats.count, candidateCount: stats.candidates.size }))
    .sort((a, b) => b.voteCount - a.voteCount)
}

export async function getCandidateTopTopics(candidateId: string, limit = 3) {
  return topTopicsFor(candidateId, limit)
}

export async function getCandidateEnrichment(slug: string): Promise<{
  brief: AiBallotBrief | null
  stances: AiTopicStances | null
  vector: AiPositionVector | null
}> {
  const candidate = await getCandidateBySlug(slug)
  return {
    brief: candidate.ai_ballot_brief || null,
    stances: candidate.ai_topic_stances as AiTopicStances | null,
    vector: candidate.ai_position_vector as AiPositionVector | null,
  }
}

export async function getAllCandidateStats(topN = 3): Promise<Map<string, { voteCount: number; topTopics: { topic: string; count: number }[] }>> {
  const result = new Map<string, { voteCount: number; topTopics: { topic: string; count: number }[] }>()
  for (const candidate of candidates()) {
    const candidateVotes = votes().filter(vote => vote.candidate_id === candidate.id)
    result.set(candidate.id, { voteCount: candidateVotes.length, topTopics: topTopicsFor(candidate.id, topN) })
  }
  return result
}

export async function getCandidateCount(): Promise<number> {
  return candidates().length
}

export async function getFilteredCandidates(options: {
  q?: string
  topics?: string[]
  minVotes?: number
  limit?: number
  offset?: number
}): Promise<CandidateWithStats[]> {
  const { q, topics = [], minVotes, limit = 100, offset = 0 } = options
  return candidates()
    .filter(candidate => (
      matchesQuery(candidate.name, q) ||
      matchesQuery(candidate.bio, q) ||
      matchesQuery(candidate.current_role, q)
    ))
    .map(candidate => ({
      candidate,
      voteCount: votes().filter(vote => vote.candidate_id === candidate.id).length,
      topTopics: topTopicsFor(candidate.id, 3),
    }))
    .filter(item => minVotes === undefined || item.voteCount >= minVotes)
    .filter(item => topics.length === 0 || votes().some(vote => vote.candidate_id === item.candidate.id && vote.topic && topics.includes(vote.topic)))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(offset, offset + limit)
}

export async function getFilteredCandidatesCount(options: {
  q?: string
  topics?: string[]
  minVotes?: number
}): Promise<number> {
  return (await getFilteredCandidates({ ...options, limit: Number.MAX_SAFE_INTEGER, offset: 0 })).length
}

export async function getCandidatesByIds(candidateIds: string[]) {
  const wanted = new Set(candidateIds)
  return candidates().filter(candidate => wanted.has(candidate.id))
}

export async function getPlatformStancesByCandidate(candidateId: string, limit = 12) {
  return db().prepare('SELECT * FROM platform_stances WHERE candidate_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(candidateId, limit) as PlatformStance[]
}

export async function getAllVotesWithCandidates(limit?: number) {
  const byCandidate = candidateById()
  const result = votes().map(vote => ({ ...vote, candidates: byCandidate.get(vote.candidate_id)! })).filter(vote => vote.candidates)
  return typeof limit === 'number' ? result.slice(0, limit) : result
}

export async function getOverlappingVotes(candidateIds: string[]): Promise<OverlappingVote[]> {
  const selected = new Set(candidateIds)
  const byCandidate = candidateById()
  const grouped = new Map<string, Vote[]>()

  for (const vote of votes().filter(vote => selected.has(vote.candidate_id))) {
    const key = vote.motion_id || `${vote.motion_title}|${vote.meeting_date}`
    grouped.set(key, [...(grouped.get(key) || []), vote])
  }

  return Array.from(grouped.values())
    .filter(group => group.length >= 2)
    .map(group => {
      const first = group[0]
      const uniqueVotes = new Set(group.map(vote => vote.vote))
      return {
        motion_title: first.motion_title,
        meeting_date: first.meeting_date,
        meeting_url: first.meeting_url,
        topic: first.topic,
        impact: first.impact,
        motion_summary: first.motion_summary,
        votes: group.map(vote => ({
          candidate_id: vote.candidate_id,
          candidate_name: byCandidate.get(vote.candidate_id)?.name || vote.candidate_id,
          vote: vote.vote,
        })),
        agreement_type: uniqueVotes.size === 1 ? 'all_agree' : uniqueVotes.size === group.length ? 'all_disagree' : 'mixed',
      }
    })
}

export async function getMotions(limit?: number) {
  const all = motions()
  return typeof limit === 'number' ? all.slice(0, limit) : all
}

export async function getMotionById(motionId: string): Promise<MotionWithVotes> {
  const motion = motions().find(motion => motion.id === motionId)
  if (!motion) throw new Error(`Motion not found: ${motionId}`)
  return withVotes(motion)
}

export async function getMotionsByTopic(topic: string, limit?: number) {
  const all = motions().filter(motion => motion.topic === topic)
  return typeof limit === 'number' ? all.slice(0, limit) : all
}

export async function getAllMotionsWithVotes(limit?: number) {
  const all = motions().map(withVotes)
  return typeof limit === 'number' ? all.slice(0, limit) : all
}

export async function getMotionExplainerByMotionId(motionId: string): Promise<MotionExplainer | null> {
  const motion = motions().find(motion => motion.id === motionId)
  const key = motion?.report_numbers?.[0]
  if (!key) return null
  const row = db().prepare('SELECT data FROM motion_explainers WHERE motion_key = ?').get(key) as { data?: string } | undefined
  return parseJson<MotionExplainer | null>(row?.data, null)
}

export async function getPairwiseBrief(candidateASlug: string, candidateBSlug: string): Promise<PairwiseBrief | null> {
  const row = db().prepare(`
    SELECT candidate_a_slug, candidate_b_slug, data
    FROM pairwise_briefs
    WHERE (candidate_a_slug = ? AND candidate_b_slug = ?)
       OR (candidate_a_slug = ? AND candidate_b_slug = ?)
    LIMIT 1
  `).get(candidateASlug, candidateBSlug, candidateBSlug, candidateASlug) as any

  if (!row) return null
  return {
    candidate_a_slug: row.candidate_a_slug,
    candidate_b_slug: row.candidate_b_slug,
    data: parseJson(row.data, {
      agree: [],
      disagree: [],
      notable_agreement: '',
      meaningful_contrast: '',
      citations: [],
    }),
  }
}

export async function getQABank(): Promise<{ slug: string; question: string; data: { answer: string; citations: any[] } }[]> {
  return []
}

export async function getFilteredMotions(options: {
  q?: string
  topics?: string[]
  candidateIds?: string[]
  impactHigh?: boolean
  limit?: number
  offset?: number
}) {
  const { q, topics = [], candidateIds = [], impactHigh = false, limit = Number.MAX_SAFE_INTEGER, offset = 0 } = options
  return motions()
    .map(withVotes)
    .filter(motion => topics.length === 0 || (motion.topic && topics.includes(motion.topic)))
    .filter(motion => !impactHigh || motion.impact === 'high')
    .filter(motion => (
      matchesQuery(motion.motion_summary, q) ||
      matchesQuery(motion.resolution, q) ||
      matchesQuery(motion.topic, q)
    ))
    .filter(motion => candidateIds.length === 0 || motion.votes.some(vote => candidateIds.includes(vote.candidate_id)))
    .slice(offset, offset + limit)
}

export async function getFilteredMotionsCount(options: {
  q?: string
  topics?: string[]
  candidateIds?: string[]
  impactHigh?: boolean
}) {
  return (await getFilteredMotions({ ...options, limit: Number.MAX_SAFE_INTEGER, offset: 0 })).length
}

export async function getCandidateMotions(candidateId: string): Promise<MotionWithVotes[]> {
  const motionIds = new Set(votes().filter(vote => vote.candidate_id === candidateId).map(vote => vote.motion_id))
  return motions().filter(motion => motionIds.has(motion.id)).map(withVotes)
}

export async function getMotionStats() {
  return getMotionTopicStats()
}

export async function getMotionTopicStats() {
  const counts = new Map<string, number>()
  for (const motion of motions()) {
    if (motion.topic) counts.set(motion.topic, (counts.get(motion.topic) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([topic, motionCount]) => ({ topic, motionCount }))
    .sort((a, b) => b.motionCount - a.motionCount)
}

export async function getMotionCount(): Promise<number> {
  return motions().length
}
