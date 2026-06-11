'use client'

import { Card } from '@tremor/react'
import DSButton from './DSButton'
import DSTextInput from './DSTextInput'
import DSNumberInput from './DSNumberInput'
import { Search, X, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { TopicFilterChips } from './TopicFilterChips'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getTypographyClasses } from '@/lib/design-tokens'

interface CandidateFiltersProps {
  filters: {
    q: string
    topics: string[]
    minVotes?: number
  }
  onFiltersChange: (filters: any) => void
  topicStats: { topic: string; voteCount: number; candidateCount: number }[]
  onClearAll: () => void
  showMinVotes?: boolean
}

export function CandidateFilters({
  filters,
  onFiltersChange,
  topicStats,
  onClearAll,
  showMinVotes = true
}: CandidateFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default on mobile

  const hasActiveFilters =
    filters.q.length > 0 ||
    filters.topics.length > 0 ||
    (showMinVotes && (filters.minVotes ?? 0) > 0)

  return (
    <form
      role="search"
      className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 mb-6"
      onSubmit={(e) => {
        // Prevent full-page navigation when pressing Enter
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Card className="rounded-none border-x-0 border-t-0">
        {/* Mobile: Collapsible header - Touch-friendly */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="md:hidden w-full flex items-center justify-between p-4 text-left min-h-[44px] transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <div className="flex items-center gap-2">
            <span className={cn(getTypographyClasses('body'), "font-semibold")}>Filters</span>
            {hasActiveFilters && (
              <span className={cn(
                getTypographyClasses('caption'),
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded-full"
              )}>
                {[
                  filters.q && 1,
                  filters.topics.length,
                  showMinVotes && (filters.minVotes ?? 0) > 0 && 1
                ]
                  .filter(Boolean)
                  .reduce((a, b) => (a as number) + (b as number), 0)} active
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {/* Filter panel */}
        <div
          id="filter-panel"
          className={`${isExpanded ? 'block' : 'hidden'} md:block p-4 md:p-6 space-y-6`}
        >
          {/* Search - Touch-friendly input */}
          <fieldset>
            <legend className="sr-only">Search candidates</legend>
            <DSTextInput
              icon={Search}
              placeholder="Search by name, role, or bio..."
              value={filters.q}
              onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
              ariaLabel="Search candidates by keyword"
              ariaDescribedBy="search-help"
              className="min-h-[44px]"
            />
            <span id="search-help" className="sr-only">
              Search candidates by name, role, or bio keyword
            </span>
          </fieldset>

          {/* Topics */}
          <fieldset>
            <legend className={cn(getTypographyClasses('body'), "font-semibold mb-3 text-gray-700 dark:text-gray-300")}>
              Filter by Topic
            </legend>
            <TopicFilterChips
              topics={topicStats}
              selectedTopics={filters.topics}
              onToggleTopic={(topic) => {
                const newTopics = filters.topics.includes(topic)
                  ? filters.topics.filter(t => t !== topic)
                  : [...filters.topics, topic]
                onFiltersChange({ ...filters, topics: newTopics })
              }}
            />
          </fieldset>

          {/* Minimum Votes */}
          {showMinVotes && (
            <fieldset>
              <legend className={cn(getTypographyClasses('body'), "font-semibold mb-3 text-gray-700 dark:text-gray-300")}>
                Minimum Vote Count
              </legend>
              <div className="flex gap-2 items-center">
                <DSNumberInput
                  value={filters.minVotes ?? 0}
                  onValueChange={(value) => onFiltersChange({ ...filters, minVotes: value || 0 })}
                  placeholder="0"
                  min={0}
                  icon={TrendingUp}
                  className="min-h-[44px]"
                  ariaLabel="Filter by minimum number of votes"
                />
                {(filters.minVotes ?? 0) > 0 && (
                  <span className={cn(getTypographyClasses('body'), "text-gray-600 dark:text-gray-400 whitespace-nowrap")}>
                    {filters.minVotes}+ votes
                  </span>
                )}
              </div>
            </fieldset>
          )}

          {/* Clear All - Touch-friendly */}
          {hasActiveFilters && (
            <div className="pt-2">
              <DSButton
                type="button"
                variant="secondary"
                onClick={onClearAll}
                className="inline-flex items-center gap-2 min-h-[44px]"
                icon={X}
              >
                Clear All Filters
              </DSButton>
            </div>
          )}
        </div>
      </Card>
    </form>
  )
}
