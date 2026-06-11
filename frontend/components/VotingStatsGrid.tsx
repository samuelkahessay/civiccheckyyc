'use client'

import type { Vote } from '@/lib/localData'
import { Card, Metric, Text, Flex } from '@tremor/react'

interface VotingStatsGridProps {
  votes: Vote[]
  onVoteClick?: (voteType: 'for' | 'against') => void
}

export function VotingStatsGrid({ votes, onVoteClick }: VotingStatsGridProps) {
  // Calculate stats
  const forCount = votes.filter(v => v.vote === 'for').length
  const againstCount = votes.filter(v => v.vote === 'against').length
  const absentCount = votes.filter(v => v.vote === 'absent').length

  // Calculate percentages for full distribution (for/against/absent)
  const total = votes.length || 1
  const forPercent = (forCount / total) * 100
  const againstPercent = (againstCount / total) * 100
  const absentPercent = (absentCount / total) * 100

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card
          decoration="left"
          decorationColor="emerald"
          className={onVoteClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors" : ""}
          onClick={() => onVoteClick?.('for')}
        >
          <Text>Voted For</Text>
          <Metric className="text-green-600 dark:text-green-400">{forCount}</Metric>
          <Text className="mt-1">{forPercent.toFixed(0)}% of {total}</Text>
        </Card>

        <Card
          decoration="left"
          decorationColor="red"
          className={onVoteClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors" : ""}
          onClick={() => onVoteClick?.('against')}
        >
          <Text>Voted Against</Text>
          <Metric className="text-red-600 dark:text-red-400">{againstCount}</Metric>
          <Text className="mt-1">{againstPercent.toFixed(0)}% of {total}</Text>
        </Card>

        <Card decoration="left" decorationColor="gray">
          <Text>Absent</Text>
          <Metric className="text-gray-600 dark:text-gray-400">{absentCount}</Metric>
          <Text className="mt-1">{absentPercent.toFixed(0)}% of {total}</Text>
        </Card>
      </div>

      {/* Vote Distribution Bar */}
      <Card>
        <Text className="mb-2">Vote Distribution</Text>
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 mt-2">
          {forCount > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${forPercent}%` }}
              title={`For: ${forCount} (${forPercent.toFixed(1)}%)`}
            />
          )}
          {againstCount > 0 && (
            <div
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${againstPercent}%` }}
              title={`Against: ${againstCount} (${againstPercent.toFixed(1)}%)`}
            />
          )}
          {absentCount > 0 && (
            <div
              className="bg-gray-400 transition-all duration-300"
              style={{ width: `${absentPercent}%` }}
              title={`Absent: ${absentCount} (${absentPercent.toFixed(1)}%)`}
            />
          )}
        </div>
        <Flex className="mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
            <span>For: {forCount} ({forPercent.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Against: {againstCount} ({againstPercent.toFixed(1)}%)</span>
          </div>
          {absentCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <span>Absent: {absentCount} ({absentPercent.toFixed(1)}%)</span>
            </div>
          )}
        </Flex>
      </Card>
    </div>
  )
}
