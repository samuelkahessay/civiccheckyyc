'use client'

import type { Vote } from '@/lib/localData'
import { SimpleVoteCard } from './SimpleVoteCard'
import { formatTopicName } from '@/lib/utils'
import { Flame, X } from 'lucide-react'
import { TopicBadge } from './UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'

interface KeyDecisionsSectionProps {
  highImpactVotes: Vote[]
  highImpactCount: number
  topicFilter?: string
  onClearFilter?: () => void
}

export function KeyDecisionsSection({ highImpactVotes, highImpactCount, topicFilter = 'all', onClearFilter }: KeyDecisionsSectionProps) {
  const handleCardClick = (voteId: string) => {
    const element = document.getElementById(`vote-${voteId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleViewAll = () => {
    const element = document.getElementById('voting-record')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (highImpactVotes.length === 0) {
    return null
  }

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-3">
        <Flame className="w-7 h-7 text-red-500" />
        <h2 className={getTypographyClasses('sectionHeader')}>Key Decisions</h2>
        <span className="text-sm text-muted-foreground">
          ({topicFilter !== 'all' ? `${highImpactVotes.length} of ` : ''}{highImpactCount} high-impact votes)
        </span>
      </div>
      {topicFilter !== 'all' && onClearFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Filtered by topic:</span>
          <button onClick={onClearFilter}>
            <TopicBadge topic={formatTopicName(topicFilter)} />
          </button>
        </div>
      )}
      <p className="text-muted-foreground mb-6">
        These are the most significant votes on major policy changes, large budget items, and decisions with substantial community impact.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {highImpactVotes.map(vote => (
          <SimpleVoteCard
            key={vote.id}
            vote={vote}
            onClick={() => handleCardClick(vote.id)}
          />
        ))}
      </div>
      {highImpactCount > 10 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleViewAll}
            className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:underline transition-colors"
          >
            View all {highImpactCount} high-impact votes below →
          </button>
        </div>
      )}
    </div>
  )
}
