import { getMotionById, getMotionExplainerByMotionId } from '@/lib/localData'
import { Card, DonutChart } from '@tremor/react'
import { ArrowLeft, Calendar, FileText, CheckCircle, XCircle, MinusCircle, Flame, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { formatTopicName } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ImpactBadge, TopicBadge, UnifiedBadge, VoteBadge as UnifiedVoteBadge } from '@/components/UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'

export const revalidate = 3600

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params

  try {
    const motion = await getMotionById(id)

    return {
      title: `${motion.motion_summary || motion.resolution?.substring(0, 60)} - CivicCheckYYC`,
      description: motion.motion_summary || motion.resolution?.substring(0, 160),
      openGraph: {
        title: motion.motion_summary || 'Council Motion',
        description: motion.motion_summary || motion.resolution?.substring(0, 160),
        type: 'article',
      },
    }
  } catch {
    return {
      title: 'Motion Not Found - CivicCheckYYC',
    }
  }
}

export default async function MotionDetailPage({ params }: PageProps) {
  const { id } = await params

  let motion
  try {
    motion = await getMotionById(id)
  } catch (error) {
    notFound()
  }

  const explainer = await getMotionExplainerByMotionId(id)

  // De-duplicate votes by candidate to avoid accidental duplicates after data merges
  // Preference order: 'for' > 'against' > 'absent'
  const dedupedVotes = (() => {
    if (!motion.votes || motion.votes.length === 0) return [] as typeof motion.votes
    const order: Record<string, number> = { 'for': 3, 'against': 2, 'absent': 1 }
    const bestByCandidate = new Map<string, (typeof motion.votes)[number]>()
    for (const v of motion.votes) {
      const current = bestByCandidate.get(v.candidate_id)
      if (!current) {
        bestByCandidate.set(v.candidate_id, v)
        continue
      }
      const currScore = order[(current as any).vote] || 0
      const nextScore = order[(v as any).vote] || 0
      if (nextScore > currScore) {
        bestByCandidate.set(v.candidate_id, v)
      }
    }
    return Array.from(bestByCandidate.values())
  })()

  // Calculate vote breakdown from deduped list
  const forCount = dedupedVotes.filter(v => v.vote === 'for').length || 0
  const againstCount = dedupedVotes.filter(v => v.vote === 'against').length || 0
  const absentCount = dedupedVotes.filter(v => v.vote === 'absent').length || 0
  const totalVotes = dedupedVotes.length || 0

  const isUnanimous = (forCount === totalVotes || againstCount === totalVotes) && totalVotes > 0
  const isSplit = forCount > 0 && againstCount > 0

  // Get truncated motion title for breadcrumb
  const motionTitle = motion.motion_summary || motion.resolution
  const truncatedTitle = motionTitle.length > 50 ? motionTitle.substring(0, 50) + '...' : motionTitle

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[
            { label: 'Motions', href: '/motions' },
            { label: truncatedTitle }
          ]} />

          {/* Motion Header */}
          <Card className="mb-6 p-6">
            <h1 className={getTypographyClasses('pageTitle')}>
              {motion.motion_summary || motion.resolution}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(motion.meeting_date), 'MMMM d, yyyy')}</span>
              </div>

              {motion.topic && (
                <Link href={`/topics/${encodeURIComponent(motion.topic)}`}>
                  <TopicBadge topic={formatTopicName(motion.topic)} />
                </Link>
              )}

              {motion.impact === 'high' && (
                <ImpactBadge impactType="high" showIcon={true} />
              )}

              {motion.meeting_type && (
                <UnifiedBadge>{motion.meeting_type}</UnifiedBadge>
              )}
            </div>

            {/* Vote Summary */}
            {totalVotes > 0 && (
              <div className="space-y-3 mb-4">
                {/* Proportional vote bar */}
                <div className="w-full">
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {forCount > 0 && (
                      <div
                        className="bg-green-500 dark:bg-green-400 transition-all duration-300"
                        style={{ width: `${(forCount / totalVotes) * 100}%` }}
                        title={`${forCount} For (${Math.round((forCount / totalVotes) * 100)}%)`}
                      />
                    )}
                    {againstCount > 0 && (
                      <div
                        className="bg-red-500 dark:bg-red-400 transition-all duration-300"
                        style={{ width: `${(againstCount / totalVotes) * 100}%` }}
                        title={`${againstCount} Against (${Math.round((againstCount / totalVotes) * 100)}%)`}
                      />
                    )}
                    {absentCount > 0 && (
                      <div
                        className="bg-gray-400 dark:bg-gray-500 transition-all duration-300"
                        style={{ width: `${(absentCount / totalVotes) * 100}%` }}
                        title={`${absentCount} Absent (${Math.round((absentCount / totalVotes) * 100)}%)`}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {forCount > 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {forCount} For ({Math.round((forCount / totalVotes) * 100)}%)
                      </span>
                    </div>
                  )}
                  {againstCount > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        {againstCount} Against ({Math.round((againstCount / totalVotes) * 100)}%)
                      </span>
                    </div>
                  )}
                  {absentCount > 0 && (
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-5 h-5 text-gray-500" />
                      <span className="font-semibold text-gray-600 dark:text-gray-400">
                        {absentCount} Absent
                      </span>
                    </div>
                  )}

                  {isUnanimous && (
                    <UnifiedBadge semanticType="success">Unanimous</UnifiedBadge>
                  )}
                  {isSplit && (
                    <UnifiedBadge semanticType="warning">Split Decision</UnifiedBadge>
                  )}
                </div>
              </div>
            )}

            {/* Resolution Text */}
            {motion.resolution && motion.resolution !== motion.motion_summary && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Original Resolution</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{motion.resolution}</p>
              </div>
            )}

            {/* Report Numbers */}
            {motion.report_numbers && motion.report_numbers.length > 0 && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <strong>Report Numbers:</strong> {motion.report_numbers.join(', ')}
              </div>
            )}
          </Card>

          {/* Explainer (Enrichment) */}
          {explainer && Array.isArray(explainer.citations) && explainer.citations.length > 0 && (
            <Card className="mb-6 p-6">
              <h2 className={getTypographyClasses('sectionHeader')}>What This Motion Does</h2>
              <p className="text-gray-800 dark:text-gray-200 mb-3">{explainer.eli5}</p>
              <div className="mt-3">
                <h3 className="text-sm font-semibold mb-1">Why it matters</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{explainer.why_it_matters}</p>
              </div>
              {Array.isArray(explainer.key_impacts) && explainer.key_impacts.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold mb-1">Key impacts</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {explainer.key_impacts.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {/* Citations */}
              {/** lazy import to avoid server warnings */}
              {require('@/components/CitationsToggle').default && (
                // dynamic require to avoid top-level use client constraints here
                (() => {
                  const CitationsToggle = require('@/components/CitationsToggle').default
                  return <CitationsToggle citations={explainer.citations as any[]} className="mt-3" />
                })()
              )}
            </Card>
          )}

          {/* Candidates Who Voted */}
          {dedupedVotes && dedupedVotes.length > 0 && (
            <Card className="mb-6 p-6">
              <h2 className={getTypographyClasses('sectionHeader')}>How Candidates Voted</h2>
              <div className="grid gap-3">
                {dedupedVotes.map((vote) => (
                  <Link
                    key={vote.id}
                    href={`/candidates/${vote.candidates.slug}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{vote.candidates.name}</span>
                      {vote.candidates.current_role && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {vote.candidates.current_role}
                        </span>
                      )}
                    </div>
                    <UnifiedVoteBadge voteType={vote.vote} />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Meeting Links */}
          {(motion.meeting_url || motion.agenda_url || motion.minutes_url || motion.source_portal_url) && (
            <Card className="mb-6 p-6">
              <h2 className={getTypographyClasses('sectionHeader')}>Meeting Documents</h2>
              <div className="flex flex-col gap-3">
                {motion.meeting_url && (
                  <a
                    href={motion.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Meeting Details
                  </a>
                )}
                {motion.agenda_url && (
                  <a
                    href={motion.agenda_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Meeting Agenda
                  </a>
                )}
                {motion.minutes_url && (
                  <a
                    href={motion.minutes_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Meeting Minutes
                  </a>
                )}
                {motion.source_portal_url && (
                  <a
                    href={motion.source_portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Calgary Open Data
                  </a>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
