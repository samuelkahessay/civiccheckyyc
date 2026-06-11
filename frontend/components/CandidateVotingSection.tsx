'use client'

import { useState } from 'react'
import type { Vote } from '@/lib/localData'
import { VotingStatsGrid } from './VotingStatsGrid'
import { VotingTimelineChart } from './VotingTimelineChart'
import { VotesByTopicChart } from './VotesByTopicChart'
import { KeyDecisionsSection } from './KeyDecisionsSection'
import { VotingRecordSection } from './VotingRecordSection'

interface CandidateVotingSectionProps {
  votes: Vote[]
  highImpactVotes: Vote[]
  highImpactCount: number
}

export function CandidateVotingSection({ votes, highImpactVotes, highImpactCount }: CandidateVotingSectionProps) {
  const [voteFilter, setVoteFilter] = useState<'all' | 'for' | 'against'>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')

  const handleVoteClick = (voteType: 'for' | 'against') => {
    setVoteFilter(voteType)
    // Scroll to voting record section
    const votingRecordElement = document.getElementById('voting-record')
    if (votingRecordElement) {
      votingRecordElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleTopicClick = (topic: string) => {
    setTopicFilter(topic)
    // Scroll to voting record section
    const votingRecordElement = document.getElementById('voting-record')
    if (votingRecordElement) {
      votingRecordElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Filter high impact votes by topic
  const filteredHighImpactVotes = topicFilter === 'all'
    ? highImpactVotes
    : highImpactVotes.filter(v => v.topic === topicFilter)

  return (
    <>
      {/* Stats */}
      <div className="mb-8">
        <VotingStatsGrid votes={votes} onVoteClick={handleVoteClick} />
      </div>

      {/* Voting Timeline */}
      <div className="mb-8">
        <VotingTimelineChart votes={votes} />
      </div>

      {/* Votes by Topic */}
      <div className="mb-8">
        <VotesByTopicChart votes={votes} onTopicClick={handleTopicClick} />
      </div>

      {/* Key Decisions Section */}
      <KeyDecisionsSection
        highImpactVotes={filteredHighImpactVotes}
        highImpactCount={highImpactCount}
        topicFilter={topicFilter}
        onClearFilter={() => setTopicFilter('all')}
      />

      {/* Voting Record with Filters */}
      <div id="voting-record">
        <VotingRecordSection votes={votes} voteFilter={voteFilter} topicFilter={topicFilter} />
      </div>
    </>
  )
}
