'use client'

import type { MotionWithVotes } from '@/lib/localData'
 
import { Calendar, Users, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { formatTopicName, cn, parseMeetingDate } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCardClasses } from '@/lib/component-variants'
import { getTypographyClasses } from '@/lib/design-tokens'
import { CouncilResultBadge } from './CouncilResultBadge'
import { ImpactBadge, TopicBadge, UnifiedBadge } from './UnifiedBadge'

interface MotionCardProps {
  motion: MotionWithVotes
  onTopicClick?: (topic: string) => void
  onCandidateClick?: (candidateId: string) => void
  showCandidates?: boolean
}

export function MotionCard({ motion, onTopicClick, onCandidateClick, showCandidates = true }: MotionCardProps) {
  const router = useRouter()

  // De-duplicate votes by candidate to avoid accidental duplicates after data merges
  const dedupedVotes = (() => {
    const votes = motion.votes || []
    const order: Record<string, number> = { 'for': 3, 'against': 2, 'absent': 1 }
    const bestByCandidate = new Map<string, typeof votes[number]>()
    for (const v of votes) {
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

  // Calculate vote breakdown from deduped votes
  const forCount = dedupedVotes.filter(v => v.vote === 'for').length || 0
  const againstCount = dedupedVotes.filter(v => v.vote === 'against').length || 0
  const absentCount = dedupedVotes.filter(v => v.vote === 'absent').length || 0
  const totalVotes = dedupedVotes.length || 0


  return (
    <div
      className={getCardClasses({
        padding: 'default',
        interactive: 'clickable',
        className: 'h-full'
      })}
      onClick={() => router.push(`/motions/${motion.id}`)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className={cn(
            getTypographyClasses('cardTitle'),
            "text-gray-900 dark:text-gray-50 mb-3"
          )}>
            {motion.motion_summary || motion.resolution?.substring(0, 120) + '...'}
          </h3>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Date */}
            <div className={cn(getTypographyClasses('caption'), "flex items-center gap-1.5 text-gray-500 dark:text-gray-400")}>
              <Calendar className="w-4 h-4" />
              <span>{format(parseMeetingDate(motion.meeting_date), 'MMM d, yyyy')}</span>
            </div>

            {/* Topic */}
            {motion.topic && (
              onTopicClick ? (
                <TopicBadge
                  topic={formatTopicName(motion.topic)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onTopicClick(motion.topic!)
                  }}
                />
              ) : (
                <TopicBadge topic={formatTopicName(motion.topic)} />
              )
            )}

            {/* High Impact */}
            {motion.impact === 'high' && (
              <ImpactBadge impactType="high" showIcon={true} />
            )}

            {/* Vote Count */}
            <div className={cn(getTypographyClasses('caption'), "flex items-center gap-1.5 text-gray-500 dark:text-gray-400")}>
              <Users className="w-4 h-4" />
              <span>{totalVotes} tracked candidate{totalVotes !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Vote Breakdown Visualization */}
        {totalVotes > 0 && (
          <div className="space-y-3">
            {/* Proportional vote bar */}
            <div className="w-full">
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
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

            {/* Vote counts + agreement indicator */}
            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
              {forCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className={cn(getTypographyClasses('caption'), "font-semibold text-green-700 dark:text-green-400")}>
                    {forCount} For
                  </span>
                </div>
              )}
              {againstCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className={cn(getTypographyClasses('caption'), "font-semibold text-red-700 dark:text-red-400")}>
                    {againstCount} Against
                  </span>
                </div>
              )}
              {absentCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <MinusCircle className="w-4 h-4 text-gray-500" />
                  <span className={cn(getTypographyClasses('caption'), "font-semibold text-gray-600 dark:text-gray-400")}>
                    {absentCount} Absent
                  </span>
                </div>
              )}

              <CouncilResultBadge motion={motion} />
            </div>
          </div>
        )}

        {/* Candidate List */}
        {showCandidates && dedupedVotes && dedupedVotes.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400 mb-2")}>
              Candidates who voted:
            </div>
            <div className="flex flex-wrap gap-2">
              {dedupedVotes.map((vote) => (
                onCandidateClick ? (
                  <button
                    key={vote.id}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCandidateClick(vote.candidate_id) }}
                    className={`
                      px-2 py-1 rounded text-xs font-medium transition-all
                      ${vote.vote === 'for'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200'
                        : vote.vote === 'against'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }
                    `}
                  >
                    {vote.candidates.name.split(' ')[0]}
                    {' '}
                    {vote.vote === 'for' ? '✓' : vote.vote === 'against' ? '✗' : '−'}
                  </button>
                ) : (
                  <Link
                    key={vote.id}
                    href={`/candidates/${vote.candidates.slug}`}
                    className="group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`
                      px-2 py-1 rounded text-xs font-medium transition-all
                      ${vote.vote === 'for'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200'
                        : vote.vote === 'against'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }
                    `}>
                      {vote.candidates.name.split(' ')[0]}
                      {' '}
                      {vote.vote === 'for' ? '✓' : vote.vote === 'against' ? '✗' : '−'}
                    </div>
                  </Link>
                )
              ))}
            </div>
          </div>
        )}

        {/* Report Numbers */}
        {motion.report_numbers && motion.report_numbers.length > 0 && (
          <div className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400")}>
            Report: {motion.report_numbers.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
