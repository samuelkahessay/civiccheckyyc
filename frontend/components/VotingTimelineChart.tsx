'use client'

import type { Vote } from '@/lib/localData'
import { Card, AreaChart } from '@tremor/react'
import { format, parseISO } from 'date-fns'

interface VotingTimelineChartProps {
  votes: Vote[]
}

export function VotingTimelineChart({ votes }: VotingTimelineChartProps) {
  // Group votes by month and vote type (excluding absent)
  const timelineData = votes.reduce((acc, vote) => {
    try {
      const date = parseISO(vote.meeting_date)
      const monthKey = format(date, 'MMM yyyy')

      if (!acc[monthKey]) {
        acc[monthKey] = { date: monthKey, For: 0, Against: 0, dateObj: date }
      }

      if (vote.vote === 'for') {
        acc[monthKey].For++
      } else if (vote.vote === 'against') {
        acc[monthKey].Against++
      }
    } catch (error) {
      // Skip invalid dates
    }

    return acc
  }, {} as Record<string, { date: string; For: number; Against: number; dateObj: Date }>)

  // Convert to array and sort by date
  const chartData = Object.values(timelineData)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map(({ date, For, Against }) => ({ date, For, Against }))

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
        Voting Activity Over Time
      </h3>
      <AreaChart
        data={chartData}
        index="date"
        categories={['Against', 'For']}
        colors={['red', 'emerald']}
        yAxisWidth={30}
        className="h-80"
        showLegend={true}
        showGradient={false}
        stack={false}
        curveType="natural"
      />
    </Card>
  )
}
