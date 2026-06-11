'use client'

import { Card, TabGroup, TabList, Tab, MultiSelect, MultiSelectItem, Select, SelectItem } from '@tremor/react'
import { Search, X, LayoutGrid, List, Flame, FileText } from 'lucide-react'
import { getTypographyClasses } from '@/lib/design-tokens'
import type { Candidate } from '@/lib/supabase'
import DSTextInput from './DSTextInput'
import DSButton from './DSButton'

interface DashboardFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: 'candidates' | 'votes' | 'motions'
  onViewModeChange: (mode: 'candidates' | 'votes' | 'motions') => void
  selectedCandidates: string[]
  onToggleCandidate: (candidateId: string) => void
  candidates: Candidate[]
  votePositionFilter: 'all' | 'for' | 'against' | 'absent'
  onVotePositionChange: (position: 'all' | 'for' | 'against' | 'absent') => void
  showHighImpactOnly: boolean
  onToggleHighImpact: () => void
  onClearAllFilters: () => void
}

export function DashboardFilters({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  selectedCandidates,
  onToggleCandidate,
  candidates,
  votePositionFilter,
  onVotePositionChange,
  showHighImpactOnly,
  onToggleHighImpact,
  onClearAllFilters
}: DashboardFiltersProps) {
  const hasActiveFilters =
    searchQuery.length > 0 ||
    selectedCandidates.length > 0 ||
    votePositionFilter !== 'all' ||
    showHighImpactOnly

  return (
    <Card className="p-6 mb-6">
      {/* Search Bar */}
      <div className="mb-4">
        <DSTextInput
          icon={Search}
          placeholder="Search votes by keyword, motion title, or topic..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <TabGroup
          index={viewMode === 'candidates' ? 0 : viewMode === 'votes' ? 1 : 2}
          onIndexChange={(index) => onViewModeChange(index === 0 ? 'candidates' : index === 1 ? 'votes' : 'motions')}
        >
          <TabList variant="solid">
            <Tab icon={LayoutGrid}>Candidates</Tab>
            <Tab icon={List}>Votes</Tab>
            <Tab icon={FileText}>Motions</Tab>
          </TabList>
        </TabGroup>

        {hasActiveFilters && (
          <DSButton
            size="xs"
            variant="secondary"
            onClick={onClearAllFilters}
            className="inline-flex items-center gap-1"
            icon={X}
          >
            Clear All
          </DSButton>
        )}
      </div>

      {/* Candidate Filter */}
      {candidates.length > 0 && (
        <div className="mb-4">
          <label className={getTypographyClasses('body') + " font-semibold text-gray-700 dark:text-gray-300 mb-2"}>
            Filter Votes by Candidate
          </label>
          <p className={"text-xs text-gray-500 dark:text-gray-400 mb-2"}>
            Filter the vote list to show only votes from selected candidates
          </p>
          <MultiSelect
            value={selectedCandidates}
            onValueChange={(value) => {
              // Toggle candidate selection
              value.forEach(id => {
                if (!selectedCandidates.includes(id)) {
                  onToggleCandidate(id)
                }
              })
              // Remove deselected candidates
              selectedCandidates.forEach(id => {
                if (!value.includes(id)) {
                  onToggleCandidate(id)
                }
              })
            }}
            placeholder="Select candidates to filter..."
          >
            {candidates.map((candidate) => (
              <MultiSelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </MultiSelectItem>
            ))}
          </MultiSelect>
        </div>
      )}

      {/* Vote Position & Impact Filters */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className={getTypographyClasses('body') + " font-semibold text-gray-700 dark:text-gray-300 mb-2"}>
            Vote Position
          </label>
          <Select value={votePositionFilter} onValueChange={(value) => onVotePositionChange(value as any)}>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="for">Voted For</SelectItem>
            <SelectItem value="against">Voted Against</SelectItem>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className={getTypographyClasses('body') + " font-semibold text-gray-700 dark:text-gray-300 mb-2"}>
            Impact Level
          </label>
          <DSButton
            onClick={onToggleHighImpact}
            variant={showHighImpactOnly ? "primary" : "secondary"}
            icon={Flame}
            className="w-full"
          >
            {showHighImpactOnly ? "High Impact Only" : "All Impact Levels"}
          </DSButton>
        </div>
      </div>
    </Card>
  )
}
