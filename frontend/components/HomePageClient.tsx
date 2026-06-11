'use client'

import { useRef } from 'react'
import type { Candidate, VoteWithCandidate, MotionWithVotes } from '@/lib/supabase'
import { OverviewStats } from './OverviewStats'
import { InteractiveDashboard } from './InteractiveDashboard'

interface HomePageClientProps {
  aggregateStats: {
    totalVotes: number
    totalMotions: number
    highImpactCount: number
    activeCandidates: number
    dateRange: {
      earliest: string | null
      latest: string | null
    }
  }
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

export function HomePageClient({
  aggregateStats,
  candidates,
  candidatesWithCounts,
  allVotes,
  allMotions,
  topicStats
}: HomePageClientProps) {
  const dashboardRef = useRef<{ switchToVotes: () => void; switchToCandidates: () => void; switchToMotions: () => void; enableHighImpactFilter: () => void } | null>(null)

  const handleTotalVotesClick = () => {
    const element = document.getElementById('explore-section')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // Switch to votes view
    if (dashboardRef.current) {
      dashboardRef.current.switchToVotes()
    }
  }

  const handleMotionsClick = () => {
    const element = document.getElementById('explore-section')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // Switch to motions view
    if (dashboardRef.current) {
      dashboardRef.current.switchToMotions()
    }
  }

  const handleHighImpactClick = () => {
    const element = document.getElementById('explore-section')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // Enable high impact filter and switch to motions
    if (dashboardRef.current) {
      dashboardRef.current.enableHighImpactFilter()
      dashboardRef.current.switchToMotions()
    }
  }

  return (
    <>
      <OverviewStats
        totalVotes={aggregateStats.totalVotes}
        totalMotions={aggregateStats.totalMotions}
        highImpactCount={aggregateStats.highImpactCount}
        activeCandidates={aggregateStats.activeCandidates}
        dateRange={aggregateStats.dateRange}
      />

      <h2 className="text-3xl font-bold tracking-tight mb-6">
        Explore Voting Records
      </h2>

      <div id="explore-section">
        <InteractiveDashboard
          ref={dashboardRef}
          candidates={candidates}
          candidatesWithCounts={candidatesWithCounts}
          allVotes={allVotes}
          allMotions={allMotions}
          topicStats={topicStats}
        />
      </div>
    </>
  )
}
