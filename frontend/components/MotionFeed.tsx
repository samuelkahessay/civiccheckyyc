'use client'

import type { MotionWithVotes } from '@/lib/supabase'
import { Card } from '@tremor/react'
import { MotionCard } from './MotionCard'

interface MotionFeedProps {
  motions: MotionWithVotes[]
  onTopicClick?: (topic: string) => void
  onCandidateClick?: (candidateId: string) => void
  showCandidates?: boolean
  loading?: boolean
}

export function MotionFeed({ motions, onTopicClick, onCandidateClick, showCandidates = true, loading = false }: MotionFeedProps) {
  if (motions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-1">
          No motions found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters to see more results
        </p>
      </Card>
    )
  }

  const skeletons = Array.from({ length: 6 })

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {motions.map((motion) => (
        <MotionCard
          key={motion.id}
          motion={motion}
          onTopicClick={onTopicClick}
          onCandidateClick={onCandidateClick}
          showCandidates={showCandidates}
        />
      ))}

      {loading && skeletons.map((_, idx) => (
        <div key={`skeleton-${idx}`} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 md:p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
          <div className="flex gap-3">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
