'use client'

import type { VoteWithCandidate } from '@/lib/localData'
import { Card } from '@tremor/react'
import { Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { formatTopicName, parseMeetingDate } from '@/lib/utils'
import Link from 'next/link'
import { ImpactBadge, TopicBadge, VoteBadge as UnifiedVoteBadge } from './UnifiedBadge'

interface RecentVotesPreviewProps {
  votes: VoteWithCandidate[]
  limit?: number
  onTopicClick?: (topic: string) => void
}

export function RecentVotesPreview({ votes, limit = 5, onTopicClick }: RecentVotesPreviewProps) {
  // Filter out Procedural votes to focus on substantive decisions
  const filteredVotes = votes.filter(v => v.topic !== 'Procedural')
  const recentVotes = filteredVotes.slice(0, limit)

  if (recentVotes.length === 0) {
    return (
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Recent Voting Activity
        </h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No voting data available yet. Data is being processed.
        </div>
      </Card>
    )
  }

  // Using UnifiedBadge for vote/topic/impact styling

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Recent Voting Activity
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Latest {recentVotes.length} votes
        </span>
      </div>

      <div className="space-y-3">
        {recentVotes.map((vote) => {
          return (
            <Link
              key={vote.id}
              href={`/candidates/${vote.candidates.slug}#vote-${vote.id}`}
              className="block group"
            >
              <div
                className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Candidate */}
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3 h-3 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-50 group-hover:text-red-600 transition-colors">
                        {vote.candidates.name}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-50 line-clamp-1 group-hover:text-red-600 transition-colors">
                      {vote.motion_title}
                    </h4>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <UnifiedVoteBadge voteType={vote.vote} showIcon={true} />
                    </div>

                    <span className="text-gray-400">•</span>

                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>{format(parseMeetingDate(vote.meeting_date), 'MMM d, yyyy')}</span>
                    </div>

                    {vote.topic && (
                      <>
                        <span className="text-gray-400">•</span>
                        {onTopicClick ? (
                          <button onClick={(e) => { e.stopPropagation(); if (vote.topic) onTopicClick(vote.topic); }}>
                            <TopicBadge topic={formatTopicName(vote.topic)} />
                          </button>
                        ) : (
                          <TopicBadge topic={formatTopicName(vote.topic)} />
                        )}
                      </>
                    )}

                    {vote.impact === 'high' && (
                      <>
                        <span className="text-gray-400">•</span>
                        <ImpactBadge impactType="high" showIcon={true} />
                      </>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
