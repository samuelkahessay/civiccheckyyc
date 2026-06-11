import { getMotionsByTopic, getCandidates, getAllVotesWithCandidates } from '@/lib/localData'
import { Card } from '@tremor/react'
import { Tag, ArrowLeft } from 'lucide-react'
import { formatTopicName } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { UnifiedBadge } from '@/components/UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'

export const revalidate = 3600

interface PageProps {
  params: Promise<{
    topic: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { topic } = await params
  const decodedTopic = decodeURIComponent(topic)

  return {
    title: `${formatTopicName(decodedTopic)} - Topics - CivicCheckYYC`,
    description: `Browse all council motions and candidate votes related to ${formatTopicName(decodedTopic)}.`,
  }
}

export default async function TopicPage({ params }: PageProps) {
  const { topic } = await params
  const decodedTopic = decodeURIComponent(topic)

  // Fetch motions for this topic
  const motions = await getMotionsByTopic(decodedTopic)

  if (!motions || motions.length === 0) {
    notFound()
  }

  // Get all votes for this topic to find active candidates
  const allVotes = await getAllVotesWithCandidates()
  const topicVotes = allVotes.filter(v => v.topic === decodedTopic)

  const candidateMap = new Map()
  topicVotes.forEach(vote => {
    if (!candidateMap.has(vote.candidate_id)) {
      candidateMap.set(vote.candidate_id, {
        candidate: vote.candidates,
        voteCount: 0
      })
    }
    candidateMap.get(vote.candidate_id).voteCount++
  })

  const activeCandidates = Array.from(candidateMap.values())
    .sort((a, b) => b.voteCount - a.voteCount)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[
            { label: 'Topics', href: '/motions' },
            { label: formatTopicName(decodedTopic) }
          ]} />

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Tag className="w-8 h-8 text-red-600" />
              <h1 className={getTypographyClasses('pageTitle')}>
                {formatTopicName(decodedTopic)}
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {motions.length} motions · {activeCandidates.length} candidates voted
            </p>
          </div>

          {/* Active Candidates */}
          {activeCandidates.length > 0 && (
            <Card className="mb-6 p-6">
              <h2 className={getTypographyClasses('sectionHeader')}>Candidates Active in This Topic</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {activeCandidates.map(({ candidate, voteCount }) => (
                  <Link
                    key={candidate.id}
                    href={`/candidates/${candidate.slug}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="font-medium">{candidate.name}</span>
                    <UnifiedBadge>{voteCount} votes</UnifiedBadge>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Placeholder for motions list */}
          <Card className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {motions.length} motions in this topic
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Motion list coming in Phase 2...
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
