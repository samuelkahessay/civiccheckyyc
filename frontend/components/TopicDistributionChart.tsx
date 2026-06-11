'use client'

import { Card, DonutChart } from '@tremor/react'
import { formatTopicName } from '@/lib/utils'
import { getTopicColor } from '@/lib/topicColors'

interface TopicDistributionChartProps {
  topicStats: { topic: string; voteCount: number; candidateCount: number }[]
  onTopicClick?: (topic: string) => void
}

export function TopicDistributionChart({ topicStats, onTopicClick }: TopicDistributionChartProps) {
  // Prepare data - show ALL topics (except Procedural), sorted by vote count
  const chartData = topicStats
    .filter(stat => stat.topic !== 'Procedural') // Filter out Procedural
    .map(stat => ({
      name: formatTopicName(stat.topic), // Tremor's DonutChart uses 'name' for index
      originalTopic: stat.topic,
      votes: stat.voteCount,
      candidates: stat.candidateCount
    }))

  if (chartData.length === 0) {
    return (
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Votes by Topic
        </h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No topic data available yet. Data is being processed.
        </div>
      </Card>
    )
  }

  // Colors derived from shared topic color mapping
  const colors = chartData.map(item => getTopicColor(item.originalTopic))

  // Extract category names for Legend component
  const categories = chartData.map(item => item.name)

  // Map category names back to original topics for filtering
  const categoryToOriginalTopic = chartData.reduce((acc, item) => {
    acc[item.name] = item.originalTopic
    return acc
  }, {} as Record<string, string>)

  return (
    <Card className="p-4 md:p-6 mb-6 md:mb-8">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2 md:mb-4">
        Votes by Topic
      </h3>
      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-4">
        Complete distribution of all {chartData.length} policy areas
      </p>

      <div className="flex flex-col gap-6">
        {/* Donut Chart */}
        <div className="flex justify-center">
          <DonutChart
            data={chartData}
            category="votes"
            index="name"
            valueFormatter={(value) => `${value.toLocaleString()} votes`}
            colors={colors}
            className="h-72 md:h-80"
            showLabel={true}
            showAnimation={true}
            onValueChange={(value) => {
              if (onTopicClick && value?.name) {
                const originalTopic = categoryToOriginalTopic[value.name]
                if (originalTopic) {
                  onTopicClick(originalTopic)
                }
              }
            }}
          />
        </div>

        {/* Custom Legend with Tremor Color Classes */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-4">
          {chartData.map((item, index) => {
            const color = colors[index]
            // Use Tremor's bg color classes that match the chart
            const bgColorClass = `bg-${color}-500`

            return (
              <button
                key={item.originalTopic}
                onClick={() => onTopicClick?.(item.originalTopic)}
                className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
              >
                <span className={`w-3 h-3 rounded-full ${bgColorClass} ring-2 ring-white dark:ring-gray-950`} />
                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
