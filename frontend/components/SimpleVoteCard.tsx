'use client'

import type { Vote } from "@/lib/localData"
import { formatTopicName, cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar, Info, CheckCircle, XCircle, MinusCircle } from "lucide-react"
import { getCardClasses } from "@/lib/component-variants"
import { getTypographyClasses } from "@/lib/design-tokens"
import { VoteBadge as UnifiedVoteBadgeComponent, TopicBadge } from "./UnifiedBadge"

interface SimpleVoteCardProps {
  vote: Vote
  onClick?: () => void
}

export function SimpleVoteCard({ vote, onClick }: SimpleVoteCardProps) {
  const voteConfig = {
    for: {
      borderColor: 'border-green-300 dark:border-green-700',
      textColor: 'text-green-700 dark:text-green-400',
      icon: CheckCircle,
      label: 'VOTED FOR',
      badgeBg: 'bg-green-50 dark:bg-green-950/30'
    },
    against: {
      borderColor: 'border-red-300 dark:border-red-700',
      textColor: 'text-red-700 dark:text-red-400',
      icon: XCircle,
      label: 'VOTED AGAINST',
      badgeBg: 'bg-red-50 dark:bg-red-950/30'
    },
    absent: {
      borderColor: 'border-gray-300 dark:border-gray-600',
      textColor: 'text-gray-700 dark:text-gray-400',
      icon: MinusCircle,
      label: 'ABSENT',
      badgeBg: 'bg-gray-50 dark:bg-gray-900/30'
    }
  }

  const config = voteConfig[vote.vote]
  const IconComponent = config.icon

  return (
    <div
      className={cn(
        "border-2 rounded-lg p-4 md:p-6 bg-white dark:bg-gray-950 transition-all duration-200",
        config.borderColor,
        onClick && "cursor-pointer hover:shadow-lg active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <div className="pb-4">
        <div className="flex items-center gap-2 mb-3">
          <IconComponent className={cn("w-5 h-5", config.textColor)} />
          <UnifiedVoteBadgeComponent voteType={vote.vote} showIcon={true} />
        </div>
        <h3 className={cn(getTypographyClasses('cardTitle'), "font-bold text-gray-900 dark:text-gray-50")}>
          {vote.motion_title}
        </h3>
      </div>

      <div className="pb-4">
        {vote.motion_summary && (
          <p className={cn(getTypographyClasses('body'), "text-gray-600 dark:text-gray-400 line-clamp-2")}>
            {vote.motion_summary}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className={cn(getTypographyClasses('caption'), "flex flex-wrap items-center gap-3 text-gray-500 dark:text-gray-400")}>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(vote.meeting_date), 'MMM d, yyyy')}</span>
          </div>

          {vote.topic && (
            <>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <TopicBadge topic={formatTopicName(vote.topic)} />
            </>
          )}
        </div>

        {onClick && (
          <div className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400 flex items-center gap-1")}>
            <Info className="w-3 h-3" />
            Click to view full details and sources
          </div>
        )}
      </div>
    </div>
  )
}
