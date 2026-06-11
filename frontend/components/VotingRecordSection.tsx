'use client'

import { useState, useEffect } from 'react'
import type { Vote } from '@/lib/localData'
import { VoteCard } from './VoteCard'
import { formatTopicName, getUniqueTopics } from '@/lib/utils'
import { Card } from '@tremor/react'
import DSButton from './DSButton'
import * as Select from '@radix-ui/react-select'
import * as Collapsible from '@radix-ui/react-collapsible'
import { X, BarChart3, Flame, Zap, FileText, Filter, ChevronDown } from 'lucide-react'
import { UnifiedBadge } from './UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'

interface VotingRecordSectionProps {
  votes: Vote[]
  voteFilter?: 'all' | 'for' | 'against'
  topicFilter?: string
}

type ImpactFilter = 'all' | 'high' | 'medium' | 'low'
type VoteFilter = 'all' | 'for' | 'against'

export function VotingRecordSection({ votes, voteFilter = 'all', topicFilter = 'all' }: VotingRecordSectionProps) {
  const [selectedImpact, setSelectedImpact] = useState<ImpactFilter>('all')
  const [selectedTopic, setSelectedTopic] = useState<string>(topicFilter)
  const [selectedVote, setSelectedVote] = useState<VoteFilter>(voteFilter)
  const [showProcedural, setShowProcedural] = useState(false)

  // Update selected vote when voteFilter prop changes
  useEffect(() => {
    setSelectedVote(voteFilter)
  }, [voteFilter])

  // Update selected topic when topicFilter prop changes
  useEffect(() => {
    setSelectedTopic(topicFilter)
  }, [topicFilter])

  // Get unique topics from all votes
  const uniqueTopics = getUniqueTopics(votes)

  // Calculate impact counts (conditioned by selected topic and vote)
  const impactCounts = {
    all: votes.filter(v =>
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      (selectedVote === 'all' || v.vote === selectedVote)
    ).length,
    high: votes.filter(v =>
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      (selectedVote === 'all' || v.vote === selectedVote) &&
      v.impact === 'high'
    ).length,
    medium: votes.filter(v =>
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      (selectedVote === 'all' || v.vote === selectedVote) &&
      v.impact === 'medium'
    ).length,
    low: votes.filter(v =>
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      (selectedVote === 'all' || v.vote === selectedVote) &&
      v.impact === 'low'
    ).length,
  }

  // Calculate topic counts (conditioned by selected impact and vote)
  const topicCounts = uniqueTopics.reduce((acc, topic) => {
    acc[topic] = votes.filter(v =>
      v.topic === topic &&
      (selectedImpact === 'all' || v.impact === selectedImpact) &&
      (selectedVote === 'all' || v.vote === selectedVote)
    ).length
    return acc
  }, {
    all: votes.filter(v =>
      (selectedImpact === 'all' || v.impact === selectedImpact) &&
      (selectedVote === 'all' || v.vote === selectedVote)
    ).length
  } as Record<string, number>)

  // Calculate vote counts (conditioned by selected impact and topic)
  const voteCounts = {
    all: votes.filter(v =>
      (selectedImpact === 'all' || v.impact === selectedImpact) &&
      (selectedTopic === 'all' || v.topic === selectedTopic)
    ).length,
    for: votes.filter(v =>
      (selectedImpact === 'all' || v.impact === selectedImpact) &&
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      v.vote === 'for'
    ).length,
    against: votes.filter(v =>
      (selectedImpact === 'all' || v.impact === selectedImpact) &&
      (selectedTopic === 'all' || v.topic === selectedTopic) &&
      v.vote === 'against'
    ).length,
  }

  // Separate procedural and non-procedural votes
  const proceduralVotes = votes.filter(v => v.topic === 'Procedural')
  const nonProceduralVotes = votes.filter(v => v.topic !== 'Procedural')

  // Filter votes based on selected impact, topic, AND vote type (excluding procedural from main list)
  let filteredVotes = nonProceduralVotes

  // Apply impact filter
  if (selectedImpact !== 'all') {
    filteredVotes = filteredVotes.filter(v => v.impact === selectedImpact)
  }

  // Apply vote type filter
  if (selectedVote !== 'all') {
    filteredVotes = filteredVotes.filter(v => v.vote === selectedVote)
  }

  // Apply topic filter
  if (selectedTopic !== 'all') {
    // If user explicitly selects Procedural, show it in main list
    if (selectedTopic === 'Procedural') {
      filteredVotes = proceduralVotes
      if (selectedImpact !== 'all') {
        filteredVotes = filteredVotes.filter(v => v.impact === selectedImpact)
      }
      if (selectedVote !== 'all') {
        filteredVotes = filteredVotes.filter(v => v.vote === selectedVote)
      }
    } else {
      filteredVotes = filteredVotes.filter(v => v.topic === selectedTopic)
    }
  }

  // Group filtered votes by topic
  const votesByTopic = filteredVotes.reduce((acc, vote) => {
    const topic = vote.topic || 'Other'
    if (!acc[topic]) acc[topic] = []
    acc[topic].push(vote)
    return acc
  }, {} as Record<string, Vote[]>)

  const impactOptions: Array<{ value: ImpactFilter; label: string; icon: any }> = [
    { value: 'all', label: 'All Votes', icon: BarChart3 },
    { value: 'high', label: 'High Impact', icon: Flame },
    { value: 'medium', label: 'Medium Impact', icon: Zap },
    { value: 'low', label: 'Low Impact', icon: FileText },
  ]

  const voteOptions: Array<{ value: VoteFilter; label: string }> = [
    { value: 'all', label: 'All Vote Types' },
    { value: 'for', label: 'Voted For' },
    { value: 'against', label: 'Voted Against' },
  ]

  const getImpactLabel = (value: ImpactFilter) => {
    const option = impactOptions.find(opt => opt.value === value)
    return option ? `${option.label} (${impactCounts[value]})` : 'All Votes'
  }

  const getTopicLabel = (value: string) => {
    if (value === 'all') return `All Topics (${topicCounts.all})`
    return `${formatTopicName(value)} (${topicCounts[value]})`
  }

  const getVoteLabel = (value: VoteFilter) => {
    const option = voteOptions.find(opt => opt.value === value)
    return option ? `${option.label} (${voteCounts[value]})` : 'All Vote Types'
  }

  return (
    <div>
      {/* Compact Filter Bar */}
      <Card className="p-6 mb-6">
          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />

            {/* Importance Select */}
            <Select.Root value={selectedImpact} onValueChange={(value) => setSelectedImpact(value as ImpactFilter)}>
              <Select.Trigger className="inline-flex items-center justify-between w-[200px] px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900">
                <Select.Value>
                  {getImpactLabel(selectedImpact)}
                </Select.Value>
                <Select.Icon>
                  <ChevronDown className="w-4 h-4" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg overflow-hidden z-50">
                  <Select.Viewport className="p-1">
                    {impactOptions.map(({ value, label, icon: Icon }) => (
                      <Select.Item key={value} value={value} className="relative flex items-center px-8 py-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 outline-none">
                        <Select.ItemText>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                            <span className="ml-auto text-gray-500 dark:text-gray-400 text-xs">({impactCounts[value]})</span>
                          </div>
                        </Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Topic Select */}
            <Select.Root value={selectedTopic} onValueChange={setSelectedTopic}>
              <Select.Trigger className="inline-flex items-center justify-between w-[240px] px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900">
                <Select.Value>
                  {getTopicLabel(selectedTopic)}
                </Select.Value>
                <Select.Icon>
                  <ChevronDown className="w-4 h-4" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg overflow-hidden z-50">
                  <Select.Viewport className="p-1 max-h-64 overflow-auto">
                    <Select.Item value="all" className="relative flex items-center px-8 py-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 outline-none">
                      <Select.ItemText>
                        <div className="flex items-center justify-between w-full">
                          <span>All Topics</span>
                          <span className="ml-4 text-gray-500 dark:text-gray-400 text-xs">({topicCounts.all})</span>
                        </div>
                      </Select.ItemText>
                    </Select.Item>
                    {uniqueTopics.map(topic => (
                      <Select.Item key={topic} value={topic} className="relative flex items-center px-8 py-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 outline-none">
                        <Select.ItemText>
                          <div className="flex items-center justify-between w-full">
                            <span>{formatTopicName(topic)}</span>
                            <span className="ml-4 text-gray-500 dark:text-gray-400 text-xs">({topicCounts[topic]})</span>
                          </div>
                        </Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Vote Type Select */}
            <Select.Root value={selectedVote} onValueChange={(value) => setSelectedVote(value as VoteFilter)}>
              <Select.Trigger className="inline-flex items-center justify-between w-[200px] px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900">
                <Select.Value>
                  {getVoteLabel(selectedVote)}
                </Select.Value>
                <Select.Icon>
                  <ChevronDown className="w-4 h-4" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg overflow-hidden z-50">
                  <Select.Viewport className="p-1">
                    {voteOptions.map(({ value, label }) => (
                      <Select.Item key={value} value={value} className="relative flex items-center px-8 py-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 outline-none">
                        <Select.ItemText>
                          <div className="flex items-center justify-between w-full">
                            <span>{label}</span>
                            <span className="ml-4 text-gray-500 dark:text-gray-400 text-xs">({voteCounts[value]})</span>
                          </div>
                        </Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Clear All Button */}
            {(selectedImpact !== 'all' || selectedTopic !== 'all' || selectedVote !== 'all') && (
              <DSButton
                variant="secondary"
                onClick={() => {
                  setSelectedImpact('all')
                  setSelectedTopic('all')
                  setSelectedVote('all')
                }}
                className="ml-auto text-sm py-1 px-3"
                icon={X}
              >
                Clear all
              </DSButton>
            )}
          </div>

          {/* Active Filters & Result Count */}
          {(selectedImpact !== 'all' || selectedTopic !== 'all' || selectedVote !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              <span className="text-sm text-gray-500 dark:text-gray-400">Active:</span>
              {selectedImpact !== 'all' && (
                <button onClick={() => setSelectedImpact('all')}
                  className="cursor-pointer hover:opacity-80">
                  <UnifiedBadge>
                    {selectedImpact.charAt(0).toUpperCase() + selectedImpact.slice(1)} Impact
                    <X className="w-3 h-3 ml-1" />
                  </UnifiedBadge>
                </button>
              )}
              {selectedTopic !== 'all' && (
                <button onClick={() => setSelectedTopic('all')}
                  className="cursor-pointer hover:opacity-80">
                  <UnifiedBadge>
                    {formatTopicName(selectedTopic)}
                    <X className="w-3 h-3 ml-1" />
                  </UnifiedBadge>
                </button>
              )}
              {selectedVote !== 'all' && (
                <button onClick={() => setSelectedVote('all')}
                  className="cursor-pointer hover:opacity-80">
                  <UnifiedBadge>
                    {selectedVote === 'for' ? 'Voted For' : 'Voted Against'}
                    <X className="w-3 h-3 ml-1" />
                  </UnifiedBadge>
                </button>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                Showing <span className="font-semibold">{filteredVotes.length}</span> vote{filteredVotes.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
      </Card>

      {/* Voting Record by Topic */}
      <h2 className="text-2xl font-bold tracking-tight mb-6">
        {selectedImpact === 'all' ? 'All Votes' : `${selectedImpact.charAt(0).toUpperCase() + selectedImpact.slice(1)} Impact Votes`}
      </h2>

      {Object.keys(votesByTopic).length === 0 ? (
        <Card className="text-center p-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No votes found matching your filters.
          </p>
          <div className="flex gap-3 justify-center">
            {selectedImpact !== 'all' && (
              <DSButton
                variant="secondary"
                onClick={() => setSelectedImpact('all')}
              >
                Clear importance filter
              </DSButton>
            )}
            {selectedTopic !== 'all' && (
              <DSButton
                variant="secondary"
                onClick={() => setSelectedTopic('all')}
              >
                Clear topic filter
              </DSButton>
            )}
            {selectedVote !== 'all' && (
              <DSButton
                variant="secondary"
                onClick={() => setSelectedVote('all')}
              >
                Clear vote type filter
              </DSButton>
            )}
          </div>
        </Card>
      ) : (
        Object.entries(votesByTopic).map(([topic, topicVotes]) => (
          <div key={topic} id={`topic-${topic}`} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h3 className={getTypographyClasses('componentHeader')}>{formatTopicName(topic)}</h3>
              <UnifiedBadge>
                {topicVotes.length} vote{topicVotes.length !== 1 ? 's' : ''}
              </UnifiedBadge>
            </div>
            <div className="space-y-4">
              {topicVotes.map(vote => (
                <VoteCard key={vote.id} vote={vote} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Collapsed Procedural Section */}
      {proceduralVotes.length > 0 && selectedTopic !== 'Procedural' && (
        <Collapsible.Root open={showProcedural} onOpenChange={setShowProcedural} className="mt-12">
          <Card className="p-6">
            <Collapsible.Trigger asChild>
              <button className="w-full flex items-center justify-between text-left group">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                    Routine Administrative Votes
                  </h3>
                  <UnifiedBadge>
                    {proceduralVotes.length} vote{proceduralVotes.length !== 1 ? 's' : ''}
                  </UnifiedBadge>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showProcedural ? 'rotate-180' : ''}`} />
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content className="mt-4">
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  These are routine procedural votes such as receiving reports for corporate record,
                  agenda confirmations, and closed meeting motions. While important for council operations,
                  they typically don't reflect policy decisions.
                </p>
              </div>
              <div className="space-y-4">
                {proceduralVotes.map(vote => (
                  <VoteCard key={vote.id} vote={vote} />
                ))}
              </div>
            </Collapsible.Content>
          </Card>
        </Collapsible.Root>
      )}
    </div>
  )
}
