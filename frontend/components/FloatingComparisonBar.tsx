'use client'

import type { Candidate } from '@/lib/supabase'
import DSButton from './DSButton'
import { GitCompare, X } from 'lucide-react'
import Link from 'next/link'

interface FloatingComparisonBarProps {
  selectedCandidates: Candidate[]
  onRemoveCandidate: (candidateId: string) => void
  onClearAll: () => void
}

export function FloatingComparisonBar({
  selectedCandidates,
  onRemoveCandidate,
  onClearAll
}: FloatingComparisonBarProps) {
  if (selectedCandidates.length === 0) return null

  const compareUrl = selectedCandidates.length >= 2
    ? `/compare?candidates=${selectedCandidates.map(c => c.id).join(',')}`
    : null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-white dark:bg-gray-900 border-t-2 border-red-500 shadow-2xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left side: Selected candidates */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-gray-50 whitespace-nowrap">
                  {selectedCandidates.length} selected
                </span>
              </div>

              {/* Selected candidate chips */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {selectedCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={getChipClasses({ variant: 'selected' }) + ' whitespace-nowrap'}
                  >
                    <span>{candidate.name}</span>
                    <button
                      onClick={() => onRemoveCandidate(candidate.id)}
                      className="hover:bg-red-200/60 dark:hover:bg-red-800 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${candidate.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              <DSButton
                variant="secondary"
                size="sm"
                onClick={onClearAll}
                className="whitespace-nowrap"
              >
                Clear All
              </DSButton>
              {compareUrl ? (
                <Link href={compareUrl}>
                  <DSButton
                    size="sm"
                    icon={GitCompare}
                    className="whitespace-nowrap"
                  >
                    Compare {selectedCandidates.length} Candidates
                  </DSButton>
                </Link>
              ) : (
                <DSButton
                  size="sm"
                  icon={GitCompare}
                  disabled
                  className="whitespace-nowrap"
                >
                  Select 2+ to Compare
                </DSButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import { getChipClasses } from '@/lib/component-variants'
