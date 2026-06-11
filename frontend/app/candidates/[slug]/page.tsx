import { getCandidateBySlug, getVotesByCandidate, getPlatformStancesByCandidate } from '@/lib/localData'
import { CandidateVotingSection } from '@/components/CandidateVotingSection'
import { PlatformStancesSection } from '@/components/PlatformStancesSection'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, Divider } from '@tremor/react'
import CitationsToggle from '@/components/CitationsToggle'
import { ArrowLeft, ExternalLink, Globe, Info } from 'lucide-react'
import DSButton from '@/components/DSButton'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params

  try {
    const candidate = await getCandidateBySlug(slug)
    const votes = await getVotesByCandidate(candidate.id)

    const description = candidate.current_role
      ? `View ${candidate.name}'s council voting record as ${candidate.current_role}. ${votes.length} votes tracked from Calgary City Council.`
      : `View ${candidate.name}'s council voting record. ${votes.length} votes tracked from Calgary City Council.`

    return {
      title: `${candidate.name} - Voting Record | CivicCheckYYC`,
      description,
      openGraph: {
        title: `${candidate.name} - Calgary Council Voting Record`,
        description,
        url: absoluteUrl(`/candidates/${candidate.slug}`),
        siteName: 'CivicCheckYYC',
        locale: 'en_CA',
        type: 'profile',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${candidate.name} - Voting Record`,
        description,
      },
      alternates: {
        canonical: absoluteUrl(`/candidates/${candidate.slug}`),
      },
    }
  } catch {
    return {
      title: 'Candidate Not Found - CivicCheckYYC',
    }
  }
}

export default async function CandidatePage({ params }: PageProps) {
  const { slug } = await params

  let candidate
  try {
    candidate = await getCandidateBySlug(slug)
  } catch (error) {
    notFound()
  }

  const votes = await getVotesByCandidate(candidate.id)
  const platformStances = await getPlatformStancesByCandidate(candidate.id)
  const brief = (candidate as any).ai_ballot_brief as any | null
  const stances = (candidate as any).ai_topic_stances as Record<string, any> | null

  // Get high-impact votes for Key Decisions section (limit to 10, exclude Procedural)
  const highImpactVotes = votes
    .filter(v => v.impact === 'high' && v.topic !== 'Procedural')
    .slice(0, 10)

  // Calculate high-impact count for Key Decisions section (exclude Procedural)
  const highImpactCount = votes.filter(v => v.impact === 'high' && v.topic !== 'Procedural').length

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[
            { label: 'Candidates', href: '/candidates' },
            { label: candidate.name }
          ]} />

          {/* Candidate Header */}
          <Card className="mb-6 md:mb-8 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-2 md:mb-3">
              {candidate.name}
            </h1>

            {candidate.current_role && (
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
                {candidate.current_role}
              </p>
            )}

            <div>
              {candidate.bio && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {candidate.bio}
                </p>
              )}

              {/* Links Section */}
              {(candidate.website || candidate.wikipedia_url) && (
                <>
                  <Divider className="my-4" />
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Links</h3>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                      {candidate.website && (
                        <a
                          href={candidate.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full sm:w-auto"
                        >
                          <DSButton variant="secondary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px]">
                            <Globe className="w-4 h-4" />
                            Official Website
                            <ExternalLink className="w-3 h-3" />
                          </DSButton>
                        </a>
                      )}
                      {candidate.wikipedia_url && (
                        <a
                          href={candidate.wikipedia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full sm:w-auto"
                        >
                          <DSButton variant="secondary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px]">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                            Wikipedia
                            <ExternalLink className="w-3 h-3" />
                          </DSButton>
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Ballot-Ready Brief (Enrichment) */}
          {brief && !brief.insufficient_evidence && Array.isArray(brief.citations) && brief.citations.length > 0 && (
            <Card className="mb-6 md:mb-8 p-4 md:p-6">
              <h2 className="text-xl font-semibold mb-3">Ballot‑Ready Brief</h2>
              <p className="text-gray-700 dark:text-gray-200 mb-3 whitespace-pre-wrap">{brief.brief}</p>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                {Array.isArray(brief.strengths) && brief.strengths.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Strengths</h3>
                    <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {brief.strengths.slice(0,2).map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(brief.tradeoffs) && brief.tradeoffs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Tradeoffs</h3>
                    <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {brief.tradeoffs.slice(0,2).map((t: string, i: number) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <CitationsToggle citations={brief.citations} className="mt-3" />
            </Card>
          )}

          {/* Topic Stances (Enrichment) */}
          {(() => {
            const entries = stances ? Object.entries(stances).filter(([topic, card]: any) => Array.isArray(card?.citations) && card.citations.length > 0 && !card?.insufficient_evidence) : []
            if (entries.length === 0) return null
            return (
            <Card className="mb-6 md:mb-8 p-4 md:p-6">
              <h2 className="text-xl font-semibold mb-3">Topic Stances</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {entries.slice(0, 6).map(([topic, card]: any) => (
                  <div key={topic} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="text-sm font-semibold mb-1">{topic}</div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{card.stance}</p>
                    <CitationsToggle citations={card.citations} className="mt-2" />
                  </div>
                ))}
              </div>
            </Card>
            )
          })()}

          {/* Platform Stances from Campaign (quotes with deep links) */}
          {platformStances && platformStances.length > 0 && (
            <PlatformStancesSection stances={platformStances} />
          )}

          {/* Voting Data */}
          {votes.length > 0 ? (
            <CandidateVotingSection
              votes={votes}
              highImpactVotes={highImpactVotes}
              highImpactCount={highImpactCount}
            />
          ) : (
            /* Empty state for candidates without voting records */
            <Card className="text-center p-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-50">
                No Voting Record Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                This candidate does not have a council voting record in our database.
                This may be because they have not previously served as a city councillor,
                or their voting data has not yet been processed.
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>
                  Learn more about this candidate by visiting their campaign website
                  or attending public forums and debates.
                </p>
              </div>
            </Card>
          )}

          {/* Attribution Footer */}
          <Divider className="mt-12" />
          <div className="mt-8">
            {/* Data source info */}
            <Card className="mb-6 p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3 mb-4">
                <Info className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">About This Data</h3>
              </div>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  <strong>Data Source:</strong> All voting records are sourced from the{' '}
                  <a
                    href="https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    City of Calgary Open Data Portal
                  </a>
                  , the official government database of council and committee votes.
                </p>
                <p>
                  <strong>Meeting Archives:</strong> View full meeting agendas, minutes, and videos at{' '}
                  <a
                    href="https://www.calgary.ca/council/meetings/agenda-minutes.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    calgary.ca/council/meetings
                  </a>
                  {' '}and{' '}
                  <a
                    href="https://pub-calgary.escribemeetings.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Calgary eScribe
                  </a>.
                </p>
                <p>
                  <strong>AI Processing:</strong> Motion titles and summaries are AI-generated for readability.
                  Votes marked with &quot;AI Generated&quot; badges have not been human-verified.
                  Always check the original resolution for complete accuracy.
                </p>
              </div>
            </Card>

            {/* Site info */}
            <div className="text-center text-sm text-muted-foreground">
              <p className="mb-2">
                CivicCheckYYC helps Calgary voters make informed decisions by surfacing council voting records.
              </p>
              <p className="text-xs">
                Built with data from the City of Calgary • Not affiliated with any candidate or political party
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
