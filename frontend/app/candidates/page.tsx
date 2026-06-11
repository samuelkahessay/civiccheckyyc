import { getFilteredCandidates, getFilteredCandidatesCount, getCandidateCount, getTopicStats } from '@/lib/supabase'
import { CandidatesPageClient } from '@/components/CandidatesPageClient'
import { Users } from 'lucide-react'
import { parseArray, formatTopicName } from '@/lib/utils'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    q?: string
    topics?: string
    compare?: string
  }>
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams
  const topics = parseArray(params.topics)
  const q = params.q

  if (topics.length > 0) {
    return {
      title: `${topics.map(formatTopicName).join(', ')} Candidates - CivicCheckYYC`,
      description: `Browse candidates who voted on ${topics.map(formatTopicName).join(' and ')}`
    }
  }

  if (q) {
    return {
      title: `Search: "${q}" - Candidates - CivicCheckYYC`,
      description: `Search results for "${q}" in candidates`
    }
  }

  return {
    title: 'Mayoral Candidates - CivicCheckYYC',
    description: 'Browse Calgary mayoral candidates and their council voting records',
  }
}

export default async function CandidatesPage({ searchParams }: PageProps) {
  const params = await searchParams

  const q = params.q || ''
  const topics = parseArray(params.topics)

  // Fetch data in parallel (filtered candidates + static filter data)
  const [filteredCandidates, filteredTotalCount, topicStats, totalCount] = await Promise.all([
    getFilteredCandidates({ q, topics, limit: 100, offset: 0 }),
    getFilteredCandidatesCount({ q, topics }),
    getTopicStats(),
    getCandidateCount()
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Candidates' }]} />

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-8 h-8 text-red-600" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Mayoral Candidates
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Browse candidates and their council voting records
            </p>
          </div>

          {/* Client component with filters */}
          <CandidatesPageClient
            initialCandidates={filteredCandidates}
            filteredTotalCount={filteredTotalCount}
            topicStats={topicStats}
            totalCandidateCount={totalCount}
          />
        </div>
      </div>
    </div>
  )
}
