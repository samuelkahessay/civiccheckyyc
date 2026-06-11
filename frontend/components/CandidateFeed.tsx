'use client'

import type { CandidateWithStats } from '@/lib/supabase'
import { Card } from '@tremor/react'
import { CandidateCard } from './CandidateCard'
import { Info } from 'lucide-react'
import { useMemo } from 'react'

interface CandidateFeedProps {
  candidates: CandidateWithStats[]
  onTopicClick?: (topic: string) => void
  onToggleSelection?: (candidateId: string) => void
  selectedCandidates?: string[]
  selectionDisabled?: boolean
  loading?: boolean
}

export function CandidateFeed({
  candidates,
  onTopicClick,
  onToggleSelection,
  selectedCandidates = [],
  selectionDisabled = false,
  loading = false
}: CandidateFeedProps) {
  // Split candidates into those with voting records and those without
  const { withRecords, withoutRecords } = useMemo(() => {
    const withRecords = candidates.filter(c => c.voteCount > 0)
    const withoutRecords = candidates.filter(c => c.voteCount === 0)
    return { withRecords, withoutRecords }
  }, [candidates])

  if (candidates.length === 0 && !loading) {
    return (
      <Card className="p-12 text-center">
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-1">
          No candidates found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters to see more results
        </p>
      </Card>
    )
  }

  const skeletons = Array.from({ length: 6 })

  return (
    <div>
      {/* Candidates with voting records */}
      {withRecords.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {withRecords.map((candidateData) => (
            <CandidateCard
              key={candidateData.candidate.id}
              candidate={candidateData.candidate}
              voteCount={candidateData.voteCount}
              topTopics={candidateData.topTopics}
              onTopicClick={onTopicClick}
              onToggleSelection={onToggleSelection}
              isSelected={selectedCandidates.includes(candidateData.candidate.id)}
              selectionDisabled={selectionDisabled}
            />
          ))}
        </div>
      )}

      {/* Candidates without voting records */}
      {withoutRecords.length > 0 && (
        <div className="mt-10">
          <div className="flex items-start gap-3 mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Other Declared Candidates
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                These candidates have not previously served on Calgary City Council, so no voting record is available.
                Check their campaign websites for policy positions.
              </p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-80">
            {withoutRecords.map((candidateData) => (
              <CandidateCard
                key={candidateData.candidate.id}
                candidate={candidateData.candidate}
                voteCount={candidateData.voteCount}
                topTopics={candidateData.topTopics}
                onTopicClick={onTopicClick}
                onToggleSelection={onToggleSelection}
                isSelected={selectedCandidates.includes(candidateData.candidate.id)}
                selectionDisabled={selectionDisabled}
              />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
          {skeletons.map((_, idx) => (
            <div key={`skeleton-${idx}`} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 md:p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="flex gap-2 mb-4">
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
