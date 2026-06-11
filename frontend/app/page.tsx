import { getCandidates, getAggregateStats, getAllCandidateStats, getFilteredMotions, getMotionTopicStats } from '@/lib/supabase'
import { HomeContent } from '@/components/HomeContent'
import { AlertTriangle } from 'lucide-react'
import { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { getTypographyClasses } from '@/lib/design-tokens'

export const revalidate = 900 // ISR: Revalidate every 15 minutes

export const metadata: Metadata = {
  title: 'CivicCheckYYC - Calgary Mayoral Voting Records 2025',
  description: 'Track and compare Calgary mayoral candidates based on their actual council voting records from 2020-2025. See how candidates voted on key issues like transit, housing, and public safety.',
  openGraph: {
    title: 'CivicCheckYYC - Calgary Mayoral Voting Records',
    description: 'Track and compare Calgary mayoral candidates based on their actual council voting records. Beyond promises. Real votes.',
    url: 'https://civiccheckyyc.vercel.app',
    siteName: 'CivicCheckYYC',
    locale: 'en_CA',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CivicCheckYYC — Track Calgary council voting records. Beyond promises. Real votes.',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivicCheckYYC - Calgary Mayoral Voting Records',
    description: 'Track Calgary mayoral candidates based on their actual council voting records.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://civiccheckyyc.vercel.app',
  },
}

export default async function HomePage() {
  // Fetch only the data needed for the home page preview
  let aggregateStats = {
    totalVotes: 0,
    totalMotions: 0,
    highImpactCount: 0,
    activeCandidates: 0,
    dateRange: { earliest: null as string | null, latest: null as string | null }
  }
  let recentMotions = [] as Awaited<ReturnType<typeof getFilteredMotions>>
  let topicStats = [] as Awaited<ReturnType<typeof getMotionTopicStats>>
  let candidates = [] as Awaited<ReturnType<typeof getCandidates>>

  try {
    const results = await Promise.all([
      getAggregateStats(),
      getFilteredMotions({ limit: 9, offset: 0 }), // 9 most recent motions
      getMotionTopicStats(), // Topic counts
      getCandidates(),
    ])

    aggregateStats = results[0]
    recentMotions = results[1]
    topicStats = results[2]
    candidates = results[3]
  } catch (err) {
    // If data fetch fails during build or ISR, gracefully render with empty data
    // so the page can still build.
  }

  // Batch-fetch vote counts and top topics for all candidates in a single query
  // (replaces N+1 individual queries per candidate)
  let candidateStatsMap = new Map<string, { voteCount: number; topTopics: { topic: string; count: number }[] }>()
  try {
    candidateStatsMap = await getAllCandidateStats(3)
  } catch {
    // Fall back gracefully if the batch query fails
  }

  const candidatesWithCounts = candidates.map(candidate => ({
    candidate,
    voteCount: candidateStatsMap.get(candidate.id)?.voteCount ?? 0,
    topTopics: candidateStatsMap.get(candidate.id)?.topTopics ?? [],
  }))

  // Filter to active candidates (those with voting records) and limit to 12 for preview
  const activeCandidates = candidatesWithCounts
    .filter(c => c.voteCount > 0)
    .slice(0, 12)

  // Derive active candidate count for stats
  const derivedActiveCandidates = candidatesWithCounts.filter(c => c.voteCount > 0).length

  // Get top 6 topics for home page
  const topTopics = topicStats.slice(0, 6)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="max-w-6xl mx-auto">
          {/* Compact Header */}
          <div className="mb-4 md:mb-6">
            <h1 className={cn(getTypographyClasses('pageTitle'))}>
              CivicCheckYYC
            </h1>
            <p className={cn(getTypographyClasses('body'), "text-gray-500 dark:text-gray-400 mt-1")}>
              Calgary mayoral voting records, 2020–2025
            </p>
          </div>

          {/* Overview Stats & Content Previews */}
          <HomeContent
            aggregateStats={{ ...aggregateStats, activeCandidates: derivedActiveCandidates }}
            recentMotions={recentMotions}
            activeCandidates={activeCandidates}
            topTopics={topTopics}
          />

          {/* Footer */}
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-200 dark:border-gray-700">
            {/* Alpha Version Notice */}
            <div className="mb-6 p-4 md:p-6 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                <div className={cn(getTypographyClasses('body'))}>
                  <strong className="text-yellow-900 dark:text-yellow-100 block mb-2">Alpha Version:</strong>
                  <span className="text-yellow-800 dark:text-yellow-200">
                    This site uses AI to extract and summarize voting records from Calgary Open Data.
                    All data is currently marked as &quot;AI Generated&quot; and awaiting verification. Always check sources.
                  </span>
                </div>
              </div>
            </div>

            {/* Attribution */}
            <div className={cn("text-center", getTypographyClasses('body'), "text-gray-500 dark:text-gray-400")}>
              <p>
                Data source:{' '}
                <a
                  href="https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                >
                  Calgary Open Data Portal
                </a>
              </p>
              <p className="mt-3">
                Built for civic transparency. Not affiliated with any campaign or political party.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
