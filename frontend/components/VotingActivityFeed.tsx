'use client'

import type { VoteWithCandidate } from '@/lib/localData'
import { Card } from '@tremor/react'
import { Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { formatTopicName, parseMeetingDate } from '@/lib/utils'
import Link from 'next/link'
import { ImpactBadge, TopicBadge, VoteBadge as UnifiedVoteBadge } from './UnifiedBadge'

interface VotingActivityFeedProps {
  votes: VoteWithCandidate[]
  onTopicClick?: (topic: string) => void
}

export function VotingActivityFeed({ votes, onTopicClick }: VotingActivityFeedProps) {
  if (votes.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-1">
          No votes found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters to see more results
        </p>
      </Card>
    )
  }

  // Use UnifiedBadge for consistent vote, topic, and impact styling

  return (
    <div className="space-y-4">
      {votes.map((vote) => {
        return (
          <Link
            key={vote.id}
            href={`/candidates/${vote.candidates.slug}#vote-${vote.id}`}
            className="block group"
          >
            <Card
              className={`border p-4 hover:shadow-lg transition-shadow cursor-pointer border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Candidate Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-900 dark:text-gray-50 group-hover:text-red-600 transition-colors">
                      {vote.candidates.name}
                    </span>
                  </div>

                  {/* Vote Title */}
                  <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-50 group-hover:text-red-600 transition-colors">
                    {vote.motion_title}
                  </h3>

                  {/* Summary */}
                  {vote.motion_summary && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {vote.motion_summary}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                  {/* Vote Badge */}
                  <div className="flex items-center gap-1.5">
                    <UnifiedVoteBadge voteType={vote.vote} showIcon={true} />
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{format(parseMeetingDate(vote.meeting_date), 'MMM d, yyyy')}</span>
                  </div>

                  {/* Topic */}
                  {vote.topic && (
                    onTopicClick ? (
                      <button onClick={(e) => { e.stopPropagation(); if (vote.topic) onTopicClick(vote.topic); }}>
                        <TopicBadge topic={formatTopicName(vote.topic)} />
                      </button>
                    ) : (
                      <TopicBadge topic={formatTopicName(vote.topic)} />
                    )
                  )}

                  {/* High Impact */}
                  {vote.impact === 'high' && (
                    <ImpactBadge impactType="high" showIcon={true} />
                  )}
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
