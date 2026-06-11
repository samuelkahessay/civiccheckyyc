import { getAllMotionsWithVotes, getCandidates, getMotionTopicStats, getMotionCount, getFilteredMotions, getFilteredMotionsCount } from '@/lib/supabase'
import { MotionsPageClient } from '@/components/MotionsPageClient'
import { FileText } from 'lucide-react'
import { getTypographyClasses } from '@/lib/design-tokens'
import { parseArray, formatTopicName } from '@/lib/utils'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    q?: string
    topics?: string
    impact?: string
    candidates?: string
  }>
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams
  const topics = parseArray(params.topics)
  const q = params.q

  if (topics.length > 0) {
    return {
      title: `${topics.map(formatTopicName).join(', ')} Motions - CivicCheckYYC`,
      description: `Browse council motions about ${topics.map(formatTopicName).join(' and ')}`
    }
  }

  if (q) {
    return {
      title: `Search: "${q}" - Motions - CivicCheckYYC`,
      description: `Search results for "${q}" in council motions`
    }
  }

  return {
    title: 'Council Motions - CivicCheckYYC',
    description: 'Browse all Calgary council motions and voting records'
  }
}

export default async function MotionsPage({ searchParams }: PageProps) {
  const params = await searchParams

  const q = params.q || ''
  const topics = parseArray(params.topics)
  const candidateIds = parseArray(params.candidates)
  const impactHigh = params.impact === 'high'

  // Fetch data in parallel (filtered motions + static filter data)
  const [filteredMotions, filteredTotalCount, topicStats, candidates, totalCount] = await Promise.all([
    getFilteredMotions({ q, topics, candidateIds, impactHigh, limit: 120, offset: 0 }),
    getFilteredMotionsCount({ q, topics, candidateIds, impactHigh }),
    getMotionTopicStats(),
    getCandidates(),
    getMotionCount()
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Motions' }]} />

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-8 h-8 text-red-600" />
              <h1 className={getTypographyClasses('pageTitle')}>
                Council Motions
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Browse all council motions and see how candidates voted
            </p>
          </div>

          {/* Client component with filters */}
          <MotionsPageClient
            initialMotions={filteredMotions}
            filteredTotalCount={filteredTotalCount}
            topicStats={topicStats}
            candidates={candidates}
            totalMotionCount={totalCount}
          />
        </div>
      </div>
    </div>
  )
}
