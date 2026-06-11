'use client'

import type { VoteWithCandidate } from '@/lib/localData'
import { Card, BarChart } from '@tremor/react'
import { format, parseISO, startOfMonth, addMonths, isAfter } from 'date-fns'

interface CombinedVotingTimelineProps {
  votes: VoteWithCandidate[]
}

export function CombinedVotingTimeline({ votes }: CombinedVotingTimelineProps) {
  // Build a complete monthly series for the past year (last 12 months, inclusive),
  // filling months with zero counts so the recent timeline is clear.
  const monthlyCounts = votes.reduce((acc, vote) => {
    try {
      const d = parseISO(vote.meeting_date)
      const monthKey = format(startOfMonth(d), 'yyyy-MM')
      if (!acc[monthKey]) {
        acc[monthKey] = { regular: 0, high: 0 }
      }
      if (vote.impact === 'high') acc[monthKey].high++
      else acc[monthKey].regular++
    } catch (_) {
      // Ignore invalid dates
    }
    return acc
  }, {} as Record<string, { regular: number; high: number }>)

  // Determine the start and end months for the past year
  const now = startOfMonth(new Date())
  const startMonth = startOfMonth(addMonths(now, -11))

  // Generate full month list and fill zeros
  const chartData = (() => {
    const series: Array<{ date: string; fullLabel: string; 'Regular': number; 'High Impact': number }> = []
    let cursor = startOfMonth(startMonth)

    // Iterate until we pass the current month
    while (!isAfter(cursor, now)) {
      const key = format(cursor, 'yyyy-MM')
      const label = format(cursor, "MMM ''yy")
      const fullLabel = format(cursor, 'MMM yyyy')
      const counts = monthlyCounts[key] || { regular: 0, high: 0 }
      series.push({ date: label, fullLabel, 'Regular': counts.regular, 'High Impact': counts.high })
      cursor = addMonths(cursor, 1)
    }
    // Drop trailing current month if it has no data
    if (series.length > 0) {
      const last = series[series.length - 1]
      if ((last['Regular'] ?? 0) + (last['High Impact'] ?? 0) === 0) {
        series.pop()
      }
    }
    return series
  })()

  if (chartData.length === 0) {
    return (
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Voting Activity Over Time
        </h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No voting data available yet. Data is being processed.
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">
        Voting Activity (Past Year)
      </h3>
      {/* Custom tooltip: show full month label like "Aug 2025" */}
      <BarChart
        data={chartData}
        index="date"
        categories={['Regular', 'High Impact']}
        colors={['blue', 'red']}
        stack={true}
        yAxisWidth={40}
        className="h-[28rem] md:h-[32rem]"
        showLegend={true}
        // Keep labels horizontal and let Recharts auto-hide ticks to avoid overlap
        rotateLabelX={undefined}
        tickGap={70}
        xAxisLabel="Month"
        customTooltip={({ active, payload, label }) => {
          if (!active || !payload || payload.length === 0) return null
          const full = payload[0]?.payload?.fullLabel || label
          return (
            <div className="px-4 py-2">
              <div className="font-medium text-gray-900 dark:text-gray-50 mb-1">{full}</div>
              <div className="space-y-1">
                {payload
                  .filter((p: any) => p && p.type !== 'none')
                  .map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-6">
                      <span className="text-gray-600 dark:text-gray-300">{p.name}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{p.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          )
        }}
      />
    </Card>
  )
}
