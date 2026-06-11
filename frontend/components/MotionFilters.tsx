'use client'

import { Card, MultiSelect, MultiSelectItem } from '@tremor/react'
import { Search, X, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import { TopicFilterChips } from './TopicFilterChips'
import type { Candidate } from '@/lib/localData'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getTypographyClasses } from '@/lib/design-tokens'
import DSTextInput from './DSTextInput'
import DSButton from './DSButton'

interface MotionFiltersProps {
  filters: {
    q: string
    topics: string[]
    candidates: string[]
    impactHigh: boolean
  }
  onFiltersChange: (filters: any) => void
  topicStats: { topic: string; motionCount: number }[]
  candidates: Candidate[]
  onClearAll: () => void
}

export function MotionFilters({
  filters,
  onFiltersChange,
  topicStats,
  candidates,
  onClearAll
}: MotionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default on mobile

  const hasActiveFilters =
    filters.q.length > 0 ||
    filters.topics.length > 0 ||
    filters.candidates.length > 0 ||
    filters.impactHigh

  return (
    <form
      role="search"
      className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 mb-6"
      onSubmit={(e) => {
        // Prevent full-page navigation or query "?" when pressing Enter
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
                {[filters.q && 1, filters.topics.length, filters.candidates.length, filters.impactHigh && 1].filter(Boolean).reduce((a, b) => (a as number) + (b as number), 0)} active
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
            <legend className="sr-only">Search motions</legend>
            <DSTextInput
              icon={Search}
              placeholder="Search by motion title, summary, or topic..."
              value={filters.q}
              onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
              ariaLabel="Search motions by keyword"
              ariaDescribedBy="search-help"
              className="min-h-[44px]"
            />
            <span id="search-help" className="sr-only">
              Search motions by title, summary, or topic keyword
            </span>
          </fieldset>

          {/* Topics */}
          <fieldset>
            <legend className={cn(getTypographyClasses('body'), "font-semibold mb-3 text-gray-700 dark:text-gray-300")}>
              Filter by Topic
            </legend>
            <TopicFilterChips
              topics={topicStats.map(t => ({
                topic: t.topic,
                voteCount: t.motionCount, // Using motion count
                candidateCount: 0
              }))}
              selectedTopics={filters.topics}
              onToggleTopic={(topic) => {
                const newTopics = filters.topics.includes(topic)
                  ? filters.topics.filter(t => t !== topic)
                  : [...filters.topics, topic]
                onFiltersChange({ ...filters, topics: newTopics })
              }}
            />
          </fieldset>

          {/* Impact & Candidate */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <fieldset>
              <legend className={cn(getTypographyClasses('body'), "font-semibold mb-3 text-gray-700 dark:text-gray-300")}>
                Impact Level
              </legend>
              <DSButton
                type="button"
                onClick={() => onFiltersChange({ ...filters, impactHigh: !filters.impactHigh })}
                variant={filters.impactHigh ? "primary" : "secondary"}
                icon={Flame}
                className="w-full min-h-[44px]"
              >
                {filters.impactHigh ? "High Impact Only" : "All Impact Levels"}
              </DSButton>
            </fieldset>

            <fieldset>
              <legend className={cn(getTypographyClasses('body'), "font-semibold mb-3 text-gray-700 dark:text-gray-300")}>
                Filter by Candidate
              </legend>
              <MultiSelect
                value={filters.candidates}
                onValueChange={(value) => onFiltersChange({ ...filters, candidates: value })}
                placeholder="Select candidates..."
                aria-label="Filter motions by candidates who voted"
                className="min-h-[44px]"
              >
                {candidates
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(c => (
                    <MultiSelectItem key={c.id} value={c.id}>
                      {c.name}
                    </MultiSelectItem>
                  ))}
              </MultiSelect>
            </fieldset>
          </div>

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
