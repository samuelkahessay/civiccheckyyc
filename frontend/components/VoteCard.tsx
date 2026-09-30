'use client'

import { useState } from 'react'
import { VoteBadge } from "./VoteBadge"
import { SourcesPanel } from "./SourcesPanel"
import { RawSnippetCollapsible } from "./RawSnippetCollapsible"
import { ProvenanceMetadata } from "./ProvenanceMetadata"
import { PipelineExplanationModal } from "./PipelineExplanationModal"
import type { Vote } from "@/lib/localData"
import { formatTopicName, cn } from "@/lib/utils"
import { format } from "date-fns"
import { Divider } from "@tremor/react"
import DSButton from "./DSButton"
import * as Collapsible from '@radix-ui/react-collapsible'
import { Calendar, ChevronDown, Info } from "lucide-react"
import { getCardClasses } from "@/lib/component-variants"
import { getTypographyClasses } from "@/lib/design-tokens"
import { ImpactBadge, TopicBadge, VoteBadge as UnifiedVoteBadge } from "./UnifiedBadge"
import { parseMeetingDate } from '@/lib/utils'

interface VoteCardProps {
  vote: Vote
}

export function VoteCard({ vote }: VoteCardProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const voteStyles = {
    for: '',
    against: '',
    absent: ''
  }

  return (
    <div id={`vote-${vote.id}`} className={cn(getCardClasses({ padding: 'default' }), "mb-6 scroll-mt-8")}>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-4">
          <h3 className={cn(getTypographyClasses('cardTitle'), "flex-1 text-gray-900 dark:text-gray-50 break-words")}>
            {vote.motion_title}
          </h3>
          <VoteBadge confidence={vote.confidence} />
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
          {vote.topic && (
            <TopicBadge topic={formatTopicName(vote.topic)} />
          )}
          {vote.impact && (
            <ImpactBadge impactType={vote.impact} showIcon={true} />
          )}
        </div>
      </div>

      <div>
        {vote.motion_summary && (
          <p className={cn(getTypographyClasses('body'), "text-gray-600 dark:text-gray-400 mb-6")}>
            {vote.motion_summary}
          </p>
        )}

        <div className={cn(getTypographyClasses('body'), "flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4")}>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Vote:</span>
            <UnifiedVoteBadge voteType={vote.vote} showIcon={true} />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{format(parseMeetingDate(vote.meeting_date), 'MMM d, yyyy')}</span>
          </div>

          {vote.meeting_type && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Meeting:</span>
              <span className={cn(getTypographyClasses('caption'), "text-gray-700 dark:text-gray-300")}>{vote.meeting_type}</span>
            </div>
          )}
        </div>

        {/* Report numbers - always visible */}
        {vote.report_numbers && vote.report_numbers.length > 0 && (
          <>
            <Divider className="my-6" />
            <div className={cn(getTypographyClasses('caption'), "flex flex-col sm:flex-row sm:items-start gap-2")}>
              <span className="text-gray-500 dark:text-gray-400 shrink-0 sm:pt-1.5">Report{vote.report_numbers.length > 1 ? 's' : ''}:</span>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                {vote.report_numbers.map((reportNum, idx) => (
                  <a
                    key={idx}
                    href={`https://pub-calgary.escribemeetings.com/?View=Search&q=${encodeURIComponent(reportNum)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Search eScribe for ${reportNum}`}
                    className="shrink-0"
                  >
                    <DSButton variant="secondary" className="min-h-[44px] px-3 font-mono text-xs whitespace-nowrap">
                      {reportNum}
                    </DSButton>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Collapsible Technical Details */}
        <Divider className="my-6" />
        <Collapsible.Root open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
          <Collapsible.Trigger asChild>
            <button className={cn(
              "w-full flex justify-between items-center font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50 transition-colors py-2 -mx-2 px-2 min-h-[44px]",
              getTypographyClasses('body')
            )}>
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                {showTechnicalDetails ? 'Hide' : 'View'} Technical Details & Sources
              </span>
              <ChevronDown className={cn("w-5 h-5 transition-transform duration-200", showTechnicalDetails && "rotate-180")} />
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="mt-4">
            <div className="space-y-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 md:p-6">
              {/* Sources Panel */}
              <SourcesPanel vote={vote} />

              {/* Raw Snippet Collapsible */}
              <RawSnippetCollapsible sourceText={vote.source_text} />

              {/* Provenance Metadata */}
              <ProvenanceMetadata vote={vote} />

              {/* Pipeline Explanation Modal */}
              <PipelineExplanationModal />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    </div>
  )
}
