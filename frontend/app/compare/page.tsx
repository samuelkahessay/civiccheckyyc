import { getCandidatesByIds, getVotesByCandidate, getOverlappingVotes, getPairwiseBrief } from '@/lib/localData'
import type { CandidateComparisonData, OverlappingVote } from '@/lib/localData'
import { Card, BarChart, DonutChart, Divider } from '@tremor/react'
import { ArrowLeft, GitCompare, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatTopicName, parseMeetingDate } from '@/lib/utils'
import { format } from 'date-fns'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ImpactBadge, TopicBadge, UnifiedBadge } from '@/components/UnifiedBadge'
import { getTypographyClasses } from '@/lib/design-tokens'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

interface PageProps {
  searchParams: Promise<{
    candidates?: string
  }>
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams
  const candidateIds = params.candidates?.split(',').filter(Boolean) || []

  if (candidateIds.length < 2) {
    return {
      title: 'Compare Candidates - CivicCheckYYC',
      description: 'Compare voting records of Calgary mayoral candidates side by side.',
    }
  }

  try {
    const candidates = await getCandidatesByIds(candidateIds)
    const names = candidates.map(c => c.name).join(' vs ')
    const description = `Compare voting records: ${names}. See how they voted on council motions, key issues, and high-impact decisions.`

    return {
      title: `Compare: ${names} | CivicCheckYYC`,
      description,
      openGraph: {
        title: `Compare Calgary Candidates: ${names}`,
        description,
        url: absoluteUrl(`/compare?candidates=${candidateIds.join(',')}`),
        siteName: 'CivicCheckYYC',
        locale: 'en_CA',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `Compare: ${names}`,
        description,
      },
      alternates: {
        canonical: absoluteUrl('/compare'),
      },
    }
  } catch {
    return {
      title: 'Compare Candidates - CivicCheckYYC',
      description: 'Compare voting records of Calgary mayoral candidates side by side.',
    }
  }
}

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams
  const candidateIds = params.candidates?.split(',').filter(Boolean) || []

  if (candidateIds.length < 2) {
    notFound()
  }

  const candidates = await getCandidatesByIds(candidateIds)

  if (candidates.length < 2) {
    notFound()
  }

  // Get comparison data for each candidate
  const comparisonData: CandidateComparisonData[] = await Promise.all(
    candidates.map(async (candidate) => {
      const votes = await getVotesByCandidate(candidate.id)

      // Calculate stats
      const forCount = votes.filter(v => v.vote === 'for').length
      const againstCount = votes.filter(v => v.vote === 'against').length
      const absentCount = votes.filter(v => v.vote === 'absent').length
      const highImpactCount = votes.filter(v => v.impact === 'high').length

      // Topic breakdown
      const topicMap = new Map<string, { count: number; for: number; against: number }>()
      votes.forEach(vote => {
        if (vote.topic) {
          if (!topicMap.has(vote.topic)) {
            topicMap.set(vote.topic, { count: 0, for: 0, against: 0 })
          }
          const stats = topicMap.get(vote.topic)!
          stats.count++
          if (vote.vote === 'for') stats.for++
          if (vote.vote === 'against') stats.against++
        }
      })

      const topicBreakdown = Array.from(topicMap.entries())
        .map(([topic, stats]) => ({ topic, ...stats }))
        .sort((a, b) => b.count - a.count)

      return {
        candidate,
        votes,
        voteCount: votes.length,
        forCount,
        againstCount,
        absentCount,
        highImpactCount,
        topicBreakdown
      }
    })
  )

  // Prepare chart data
  const voteDistributionData = comparisonData.map(data => ({
    name: data.candidate.name,
    'Voted For': data.forCount,
    'Voted Against': data.againstCount,
    'Absent': data.absentCount
  }))

  const participationData = comparisonData.map(data => ({
    name: data.candidate.name,
    'Total Votes': data.voteCount,
    'High Impact': data.highImpactCount
  }))

  // Get all unique topics
  const allTopics = new Set<string>()
  comparisonData.forEach(data => {
    data.topicBreakdown.forEach(t => allTopics.add(t.topic))
  })

  // Get overlapping votes
  const overlappingVotes = await getOverlappingVotes(candidateIds)

  // Pairwise (enrichment): if at least 2 candidates, show comparison brief
  let pairwise: any = null
  if (candidates.length >= 2) {
    pairwise = await getPairwiseBrief(candidates[0].slug, candidates[1].slug)
  }

  // Calculate overlap statistics
  const totalOverlappingVotes = overlappingVotes.length
  const agreementCount = overlappingVotes.filter(v => v.agreement_type === 'all_agree').length
  const disagreementCount = overlappingVotes.filter(v => v.agreement_type === 'all_disagree').length
  const mixedCount = overlappingVotes.filter(v => v.agreement_type === 'mixed').length

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Compare Candidates' }]} />

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <GitCompare className="w-8 h-8 text-red-600" />
              <h1 className={getTypographyClasses('pageTitle')}>
                Candidate Comparison
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Comparing voting records for {comparisonData.map(d => d.candidate.name).join(', ')}
            </p>
          </div>

          {/* Overview Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {comparisonData.map(data => (
              <Card key={data.candidate.id} className="p-4">
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-50">
                  {data.candidate.name}
                </h3>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total votes:</span>{' '}
                    <span className="font-semibold">{data.voteCount}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">High impact:</span>{' '}
                    <span className="font-semibold text-orange-600">{data.highImpactCount}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">For/Against:</span>{' '}
                    <span className="font-semibold text-green-600">{data.forCount}</span> / {' '}
                    <span className="font-semibold text-red-600">{data.againstCount}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Vote Distribution Chart */}
          <Card className="p-6 mb-8">
            <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
              Vote Distribution
            </h2>
            <BarChart
              data={voteDistributionData}
              index="name"
              categories={['Voted For', 'Voted Against', 'Absent']}
              colors={['emerald', 'red', 'gray']}
              yAxisWidth={48}
              className="h-80"
              stack={true}
            />
          </Card>

          {/* Participation Comparison */}
          <Card className="p-6 mb-8">
            <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
              Participation & Impact
            </h2>
            <BarChart
              data={participationData}
              index="name"
              categories={['Total Votes', 'High Impact']}
              colors={['blue', 'orange']}
              yAxisWidth={48}
              className="h-80"
            />
          </Card>

          {/* Topic Comparison */}
          <Card className="p-6 mb-8">
            <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
              Voting by Topic
            </h2>
            <p className={"text-sm text-gray-600 dark:text-gray-400 mb-6"}>
              Compare how often each candidate has voted on different policy areas
            </p>
            <div className="space-y-6">
              {Array.from(allTopics).slice(0, 8).map(topic => {
                const topicData = comparisonData.map(data => {
                  const topicStats = data.topicBreakdown.find(t => t.topic === topic)
                  return {
                    name: data.candidate.name,
                    votes: topicStats?.count || 0
                  }
                })

                return (
                  <div key={topic}>
                    <h3 className={getTypographyClasses('componentHeader') + " mb-2 text-gray-900 dark:text-gray-50"}>
                      {formatTopicName(topic)}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {topicData.map(d => (
                        <div key={d.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">{d.name.split(' ')[0]}</span>
                          <span className="font-bold text-lg">{d.votes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Pairwise Comparison Brief (Enrichment) */}
          {pairwise && pairwise.data && !pairwise.data.insufficient_evidence && Array.isArray(pairwise.data.citations) && pairwise.data.citations.length > 0 && (
            <Card className="p-6 mb-8">
              <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
                Pairwise Comparison (AI)
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Areas of Agreement</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {(pairwise.data?.agree || []).slice(0,4).map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Meaningful Differences</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {(pairwise.data?.disagree || []).slice(0,4).map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              </div>
              {/* Citations */}
              {require('@/components/CitationsToggle').default && (
                (() => {
                  const CitationsToggle = require('@/components/CitationsToggle').default
                  return <CitationsToggle citations={pairwise.data?.citations as any[]} className="mt-3" />
                })()
              )}
            </Card>
          )}

          {/* Overlapping Votes Section */}
          <Card className="p-6 mb-8">
            <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
              Overlapping Votes
            </h2>
            <p className={"text-sm text-gray-600 dark:text-gray-400 mb-6"}>
              Votes where all selected candidates participated on the same motions
            </p>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Overlapping</div>
                <div className="text-2xl font-bold text-red-700">{totalOverlappingVotes}</div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agreed</div>
                <div className="text-2xl font-bold text-green-600">
                  {agreementCount}
                  {totalOverlappingVotes > 0 && (
                    <span className="text-sm ml-1">({Math.round((agreementCount / totalOverlappingVotes) * 100)}%)</span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Disagreed</div>
                <div className="text-2xl font-bold text-red-600">
                  {disagreementCount}
                  {totalOverlappingVotes > 0 && (
                    <span className="text-sm ml-1">({Math.round((disagreementCount / totalOverlappingVotes) * 100)}%)</span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mixed</div>
                <div className="text-2xl font-bold text-gray-600">
                  {mixedCount}
                  {totalOverlappingVotes > 0 && (
                    <span className="text-sm ml-1">({Math.round((mixedCount / totalOverlappingVotes) * 100)}%)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Overlapping Votes */}
            {totalOverlappingVotes > 0 ? (
              <div className="space-y-4">
                {overlappingVotes.slice(0, 20).map((overlap, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      overlap.agreement_type === 'all_agree'
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-500'
                        : overlap.agreement_type === 'all_disagree'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-500'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {overlap.agreement_type === 'all_agree' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : overlap.agreement_type === 'all_disagree' ? (
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          ) : (
                            <MinusCircle className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          )}
                          <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                            {overlap.motion_title}
                          </h3>
                        </div>
                        {overlap.motion_summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ml-7">
                            {overlap.motion_summary}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 ml-7">
                          <span>{format(parseMeetingDate(overlap.meeting_date), 'MMM d, yyyy')}</span>
                          {overlap.topic && (
                            <>
                              <span>•</span>
                              <TopicBadge topic={formatTopicName(overlap.topic)} />
                            </>
                          )}
                          {overlap.impact && (
                            <>
                              <span>•</span>
                              <ImpactBadge impactType={overlap.impact as any} showIcon={true} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Candidate Votes */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-7 mt-3">
                      {overlap.votes.map((candidateVote) => (
                        <div
                          key={candidateVote.candidate_id}
                          className={`px-3 py-2 rounded-md text-sm font-medium ${
                            candidateVote.vote === 'for'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : candidateVote.vote === 'against'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="font-semibold">{candidateVote.candidate_name.split(' ')[0]}</div>
                          <div className="text-xs capitalize">{candidateVote.vote}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {overlappingVotes.length > 20 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
                    Showing 20 of {overlappingVotes.length} overlapping votes
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No overlapping votes found between the selected candidates.</p>
                <p className="text-sm mt-2">These candidates may have served in different councils or time periods.</p>
              </div>
            )}
          </Card>

          {/* Individual Candidate Details */}
          <div className="grid md:grid-cols-2 gap-6">
            {comparisonData.map(data => (
              <Card key={data.candidate.id} className="p-6">
                <h2 className={getTypographyClasses('sectionHeader') + " mb-4 text-gray-900 dark:text-gray-50"}>
                  {data.candidate.name}
                </h2>

                {/* Vote breakdown donut */}
                <div className="mb-6">
                  <h3 className={"text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300"}>
                    Vote Position Breakdown
                  </h3>
                  <DonutChart
                    data={[
                      { name: 'For', value: data.forCount },
                      { name: 'Against', value: data.againstCount },
                      { name: 'Absent', value: data.absentCount }
                    ]}
                    category="value"
                    index="name"
                    colors={['emerald', 'red', 'gray']}
                    className="h-48"
                  />
                </div>

                {/* Top topics */}
                <div>
                  <h3 className={"text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300"}>
                    Top Voting Topics
                  </h3>
                  <div className="space-y-2">
                    {data.topicBreakdown.slice(0, 5).map(topic => (
                      <div key={topic.topic} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatTopicName(topic.topic)}
                        </span>
                        <UnifiedBadge>{topic.count} votes</UnifiedBadge>
                      </div>
                    ))}
                  </div>
                </div>

                <Divider />

                <Link href={`/candidates/${data.candidate.slug}`}>
                  <button className="w-full py-2 px-4 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors">
                    View Full Profile
                  </button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
