'use client'

import { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { Candidate, VoteWithCandidate, MotionWithVotes } from '@/lib/supabase'
import { DashboardFilters } from './DashboardFilters'
import { TopicFilterChips } from './TopicFilterChips'
import { VotingActivityFeed } from './VotingActivityFeed'
import { CandidateCard } from './CandidateCard'
import { MotionFeed } from './MotionFeed'
import { CombinedVotingTimeline } from './CombinedVotingTimeline'
import { TopicDistributionChart } from './TopicDistributionChart'
import { RecentVotesPreview } from './RecentVotesPreview'
import { FloatingComparisonBar } from './FloatingComparisonBar'
import { UnifiedBadge } from './UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'

interface InteractiveDashboardProps {
  candidates: Candidate[]
  candidatesWithCounts: {
    candidate: Candidate
    voteCount: number
    topTopics: { topic: string; count: number }[]
  }[]
  allVotes: VoteWithCandidate[]
  allMotions: MotionWithVotes[]
  topicStats: { topic: string; voteCount: number; candidateCount: number }[]
}

export interface InteractiveDashboardRef {
  switchToVotes: () => void
  switchToCandidates: () => void
  switchToMotions: () => void
  enableHighImpactFilter: () => void
}

export const InteractiveDashboard = forwardRef<InteractiveDashboardRef, InteractiveDashboardProps>(({
  candidates,
  candidatesWithCounts,
  allVotes,
  allMotions,
  topicStats
}, ref) => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([])
  const [votePositionFilter, setVotePositionFilter] = useState<'all' | 'for' | 'against' | 'absent'>('all')
  const [showHighImpactOnly, setShowHighImpactOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'candidates' | 'votes' | 'motions'>('candidates')

  // Comparison selection state (separate from filter selection)
  const [comparisonSelectedIds, setComparisonSelectedIds] = useState<string[]>([])

  // Toggle functions
  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidates(prev =>
      prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
    )
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setSelectedTopics([])
    setSelectedCandidates([])
    setVotePositionFilter('all')
    setShowHighImpactOnly(false)
  }

  // Comparison selection handlers
  const toggleComparisonSelection = (candidateId: string) => {
    setComparisonSelectedIds(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId)
      } else if (prev.length < 4) {
        return [...prev, candidateId]
      }
      return prev
    })
  }

  const removeFromComparison = (candidateId: string) => {
    setComparisonSelectedIds(prev => prev.filter(id => id !== candidateId))
  }

  const clearComparisonSelection = () => {
    setComparisonSelectedIds([])
  }

  // Get full candidate objects for comparison
  const comparisonSelectedCandidates = useMemo(() => {
    return candidates.filter(c => comparisonSelectedIds.includes(c.id))
  }, [candidates, comparisonSelectedIds])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    switchToVotes: () => setViewMode('votes'),
    switchToCandidates: () => setViewMode('candidates'),
    switchToMotions: () => setViewMode('motions'),
    enableHighImpactFilter: () => setShowHighImpactOnly(true)
  }))

  // Filtered votes
  const filteredVotes = useMemo(() => {
    return allVotes.filter(vote => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = vote.motion_title?.toLowerCase().includes(query)
        const matchesSummary = vote.motion_summary?.toLowerCase().includes(query)
        const matchesTopic = vote.topic?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesSummary && !matchesTopic) return false
      }

      // Topic filter
      if (selectedTopics.length > 0 && !selectedTopics.includes(vote.topic || '')) {
        return false
      }

      // Candidate filter
      if (selectedCandidates.length > 0 && !selectedCandidates.includes(vote.candidate_id)) {
        return false
      }

      // Vote position filter
      if (votePositionFilter !== 'all' && vote.vote !== votePositionFilter) {
        return false
      }

      // Impact filter
      if (showHighImpactOnly && vote.impact !== 'high') {
        return false
      }

      return true
    })
  }, [allVotes, searchQuery, selectedTopics, selectedCandidates, votePositionFilter, showHighImpactOnly])

  // Filtered candidates (sorted by vote count descending)
  const filteredCandidates = useMemo(() => {
    let candidates = candidatesWithCounts

    // Apply filters
    if (selectedTopics.length > 0 || selectedCandidates.length > 0) {
      candidates = candidatesWithCounts.filter(({ candidate }) => {
        // If specific candidates are selected, only show those
        if (selectedCandidates.length > 0 && !selectedCandidates.includes(candidate.id)) {
          return false
        }

        // If topics are selected, only show candidates who have votes in those topics
        if (selectedTopics.length > 0) {
          const candidateVotes = allVotes.filter(v => v.candidate_id === candidate.id)
          const hasTopicVote = candidateVotes.some(v => selectedTopics.includes(v.topic || ''))
          if (!hasTopicVote) return false
        }

        return true
      })
    }

    // Sort by vote count (descending)
    return [...candidates].sort((a, b) => b.voteCount - a.voteCount)
  }, [candidatesWithCounts, selectedTopics, selectedCandidates, allVotes])

  // Filtered motions
  const filteredMotions = useMemo(() => {
    return allMotions.filter(motion => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSummary = motion.motion_summary?.toLowerCase().includes(query)
        const matchesResolution = motion.resolution?.toLowerCase().includes(query)
        const matchesTopic = motion.topic?.toLowerCase().includes(query)
        if (!matchesSummary && !matchesResolution && !matchesTopic) return false
      }

      // Topic filter
      if (selectedTopics.length > 0 && !selectedTopics.includes(motion.topic || '')) {
        return false
      }

      // Candidate filter - show motions where selected candidates voted
      if (selectedCandidates.length > 0) {
        const hasSelectedCandidate = motion.votes?.some(v =>
          selectedCandidates.includes(v.candidate_id)
        )
        if (!hasSelectedCandidate) return false
      }

      // Impact filter
      if (showHighImpactOnly && motion.impact !== 'high') {
        return false
      }

      return true
    })
  }, [allMotions, searchQuery, selectedTopics, selectedCandidates, showHighImpactOnly])

  // Active filters display
  const activeFilters = []
  if (selectedTopics.length > 0) activeFilters.push(`${selectedTopics.length} topic(s)`)
  if (selectedCandidates.length > 0) activeFilters.push(`${selectedCandidates.length} candidate(s)`)
  if (votePositionFilter !== 'all') activeFilters.push(`Vote: ${votePositionFilter}`)
  if (showHighImpactOnly) activeFilters.push('High impact')
  if (searchQuery) activeFilters.push(`Search: "${searchQuery}"`)

  return (
    <div>
      {/* Charts Section - Always Visible */}
      <div className="mb-8">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <CombinedVotingTimeline votes={allVotes} />
          <TopicDistributionChart topicStats={topicStats} onTopicClick={toggleTopic} />
        </div>
        <RecentVotesPreview votes={allVotes} limit={5} onTopicClick={toggleTopic} />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 mb-8"></div>

      {/* Filtering Section */}
      <h3 className={getTypographyClasses('sectionHeader') + " mb-6 text-gray-900 dark:text-gray-50"}>
        Explore & Filter
      </h3>

      {/* Topic Filter Chips */}
      <div className="mb-6">
        <h3 className={getTypographyClasses('componentHeader') + " mb-3 text-gray-900 dark:text-gray-50"}>
          Filter by Topic
        </h3>
        <TopicFilterChips
          topics={topicStats}
          selectedTopics={selectedTopics}
          onToggleTopic={toggleTopic}
        />
      </div>

      {/* Dashboard Filters */}
      <DashboardFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedCandidates={selectedCandidates}
        onToggleCandidate={toggleCandidate}
        candidates={candidates}
        votePositionFilter={votePositionFilter}
        onVotePositionChange={setVotePositionFilter}
        showHighImpactOnly={showHighImpactOnly}
        onToggleHighImpact={() => setShowHighImpactOnly(!showHighImpactOnly)}
        onClearAllFilters={clearAllFilters}
      />

      {/* Active Filters Summary */}
      {activeFilters.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Active filters:
          </span>
          {activeFilters.map((filter, idx) => (
            <UnifiedBadge key={idx}>{filter}</UnifiedBadge>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {viewMode === 'candidates' ? (
            <>
              Showing <strong>{filteredCandidates.length}</strong> of{' '}
              <strong>{candidatesWithCounts.length}</strong> candidates
            </>
          ) : viewMode === 'votes' ? (
            <>
              Showing <strong>{filteredVotes.length}</strong> of{' '}
              <strong>{allVotes.length}</strong> votes
            </>
          ) : (
            <>
              Showing <strong>{filteredMotions.length}</strong> of{' '}
              <strong>{allMotions.length}</strong> motions
            </>
          )}
        </p>
      </div>

      {/* Content Area */}
      {viewMode === 'candidates' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCandidates.map(({ candidate, voteCount, topTopics }) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              voteCount={voteCount}
              topTopics={topTopics}
              onTopicClick={toggleTopic}
              isSelected={comparisonSelectedIds.includes(candidate.id)}
              onToggleSelection={toggleComparisonSelection}
              selectionDisabled={!comparisonSelectedIds.includes(candidate.id) && comparisonSelectedIds.length >= 4}
            />
          ))}
        </div>
      ) : viewMode === 'votes' ? (
        <VotingActivityFeed votes={filteredVotes} onTopicClick={toggleTopic} />
      ) : (
        <MotionFeed motions={filteredMotions} onTopicClick={toggleTopic} showCandidates={true} />
      )}

      {/* Floating Comparison Bar */}
      <FloatingComparisonBar
        selectedCandidates={comparisonSelectedCandidates}
        onRemoveCandidate={removeFromComparison}
        onClearAll={clearComparisonSelection}
      />
    </div>
  )
})

InteractiveDashboard.displayName = 'InteractiveDashboard'
