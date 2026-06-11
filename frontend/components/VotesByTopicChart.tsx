'use client'

import type { Vote } from '@/lib/localData'
import { formatTopicName } from '@/lib/utils'
import { Card, BarChart, DonutChart } from '@tremor/react'
import { getTopicColor } from '@/lib/topicColors'

interface VotesByTopicChartProps {
  votes: Vote[]
  variant?: 'bar' | 'donut'
  onTopicClick?: (topic: string) => void
}

export function VotesByTopicChart({ votes, variant = 'bar', onTopicClick }: VotesByTopicChartProps) {
  // Group votes by topic and count them
  const topicCounts = votes.reduce((acc, vote) => {
    const topic = vote.topic || 'Other'
    acc[topic] = (acc[topic] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Convert to array format for Tremor and sort by count (descending)
  // Keep track of original topic name for onClick
  // Filter out Procedural as it skews the visualization
  const chartData = Object.entries(topicCounts)
    .filter(([topic]) => topic !== 'Procedural')
    .map(([topic, count]) => ({
      topic: formatTopicName(topic),
      originalTopic: topic,
      votes: count,
    }))
    .sort((a, b) => b.votes - a.votes)

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
        Votes by Topic
      </h3>
      {variant === 'bar' ? (
        <BarChart
          data={chartData}
          index="topic"
          categories={['votes']}
          colors={['blue']}
          yAxisWidth={40}
          showLegend={false}
          className="h-[32rem]"
          showXAxis={true}
          onValueChange={(value) => {
            if (onTopicClick && value) {
              const clickedItem = chartData.find((item) => item.topic === value.topic)
              if (clickedItem) {
                onTopicClick(clickedItem.originalTopic)
              }
            }
          }}
        />
      ) : (
        <DonutChart
          data={chartData}
          category="votes"
          index="topic"
          valueFormatter={(value) => `${value} votes`}
          colors={chartData.map(d => getTopicColor(d.originalTopic))}
          className="h-80"
          onValueChange={(value) => {
            if (onTopicClick && value) {
              const clickedItem = chartData.find((item) => item.topic === value.topic)
              if (clickedItem) {
                onTopicClick(clickedItem.originalTopic)
              }
            }
          }}
        />
      )}
    </Card>
  )
}
