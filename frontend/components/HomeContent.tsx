import type { MotionWithVotes, CandidateWithStats } from '@/lib/localData'
import { OverviewStats } from './OverviewStats'
import { MotionCard } from './MotionCard'
import { CandidateCard } from './CandidateCard'
import { Card } from '@tremor/react'
import { ArrowRight, Calendar } from 'lucide-react'
import { getTypographyClasses } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { formatTopicName } from '@/lib/utils'
import { getTopicColor } from '@/lib/topicColors'

interface HomeContentProps {
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
  recentMotions: MotionWithVotes[]
  activeCandidates: CandidateWithStats[]
  topTopics: { topic: string; motionCount: number }[]
}

export function HomeContent({
  aggregateStats,
  recentMotions,
  activeCandidates,
  topTopics
}: HomeContentProps) {
  return (
    <>
      {/* Overview Stats Banner */}
      <OverviewStats
        totalVotes={aggregateStats.totalVotes}
        totalMotions={aggregateStats.totalMotions}
        highImpactCount={aggregateStats.highImpactCount}
        activeCandidates={aggregateStats.activeCandidates}
        dateRange={aggregateStats.dateRange}
      />

      {/* 2-Column Dashboard Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content — Left 2/3 */}
        <div className="lg:col-span-2">
          {/* Recent Motions */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(getTypographyClasses('sectionHeader'), "border-l-4 border-red-600 pl-3")}>
                Recent Council Motions
              </h2>
              <Link
                href="/motions"
                className="flex items-center gap-2 text-red-700 dark:text-red-400 hover:underline text-sm md:text-base font-medium"
                prefetch={true}
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentMotions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {recentMotions.slice(0, 6).map((motion) => (
                  <MotionCard
                    key={motion.id}
                    motion={motion}
                    showCandidates={false}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No recent motions available
                </p>
              </Card>
            )}
          </section>

          {/* Active Candidates */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(getTypographyClasses('sectionHeader'), "border-l-4 border-red-600 pl-3")}>
                Candidates with Voting Records
              </h2>
              <Link
                href="/candidates"
                className="flex items-center gap-2 text-red-700 dark:text-red-400 hover:underline text-sm md:text-base font-medium"
                prefetch={true}
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {activeCandidates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {activeCandidates.map((candidateData) => (
                  <CandidateCard
                    key={candidateData.candidate.id}
                    candidate={candidateData.candidate}
                    voteCount={candidateData.voteCount}
                    topTopics={candidateData.topTopics}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No active candidates with voting records
                </p>
              </Card>
            )}
          </section>
        </div>

        {/* Sidebar — Right 1/3 */}
        <div className="lg:col-span-1 space-y-6">
          {/* Topics */}
          <section>
            <h2 className={cn(getTypographyClasses('componentHeader'), "border-l-4 border-red-600 pl-3 mb-4")}>
              Explore by Topic
            </h2>
            {topTopics.length > 0 && (() => {
              const maxCount = Math.max(...topTopics.map(t => t.motionCount))
              return (
                <div className="space-y-2">
                  {topTopics.map(({ topic, motionCount }) => (
                    <Link
                      key={topic}
                      href={`/motions?topics=${encodeURIComponent(topic)}`}
                      prefetch={true}
                      className="group block"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-28 shrink-0 truncate group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                          {formatTopicName(topic)}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden relative">
                          <div
                            className={cn(
                              "h-full rounded transition-all duration-500 ease-out",
                              `bg-${getTopicColor(topic)}-500`
                            )}
                            style={{ width: `${Math.max((motionCount / maxCount) * 100, 4)}%` }}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                            {motionCount}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            })()}
          </section>

          {/* Election Info */}
          <section className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <Calendar className="w-4 h-4 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <h3 className={cn(getTypographyClasses('componentHeader'), "text-gray-900 dark:text-gray-50")}>
                Calgary 2025 Municipal Election
              </h3>
            </div>
            <div className={cn(getTypographyClasses('caption'), "text-gray-700 dark:text-gray-300 space-y-2 ml-6")}>
              <p><strong>Election Day:</strong> October 20, 2025</p>
              <p><strong>Advance Voting:</strong> October 6–11, 2025</p>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Tracks historical council voting records for candidates who served as councillors.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
