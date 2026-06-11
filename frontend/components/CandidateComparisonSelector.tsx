'use client'

import { useState } from 'react'
import { Card } from '@tremor/react'
import type { Candidate } from '@/lib/localData'
import { GitCompare, X } from 'lucide-react'
import Link from 'next/link'

interface CandidateComparisonSelectorProps {
  candidates: Candidate[]
}

export function CandidateComparisonSelector({ candidates }: CandidateComparisonSelectorProps) {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([])

  const toggleCandidate = (candidateId: string) => {
    if (selectedCandidates.includes(candidateId)) {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId))
    } else if (selectedCandidates.length < 4) {
      setSelectedCandidates([...selectedCandidates, candidateId])
    }
  }

  const compareUrl = selectedCandidates.length >= 2
    ? `/compare?candidates=${selectedCandidates.join(',')}`
    : null

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Compare Candidates
          </h2>
        </div>
        {selectedCandidates.length > 0 && (
          <DSButton
            variant="secondary"
            size="xs"
            onClick={() => setSelectedCandidates([])}
          >
            Clear All
          </DSButton>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Select 2-4 candidates to compare their voting records, topics, and positions side-by-side
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {candidates.map((candidate) => {
          const isSelected = selectedCandidates.includes(candidate.id)
          const isDisabled = !isSelected && selectedCandidates.length >= 4

          return (
            <button
              key={candidate.id}
              onClick={() => toggleCandidate(candidate.id)}
              disabled={isDisabled}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all
                ${isSelected
                  ? 'bg-red-700 text-white hover:bg-red-800'
                  : isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }
              `}
            >
              {isSelected && <X className="inline w-3 h-3 mr-1" />}
              {candidate.name}
            </button>
          )
        })}
      </div>

      {selectedCandidates.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? 's' : ''} selected
            {selectedCandidates.length === 1 && ' (select at least 2)'}
          </span>
          {compareUrl ? (
            <Link href={compareUrl}>
              <DSButton>
                Compare {selectedCandidates.length} Candidates
              </DSButton>
            </Link>
          ) : (
            <DSButton disabled>
              Compare Candidates
            </DSButton>
          )}
        </div>
      )}
    </Card>
  )
}
import DSButton from './DSButton'
