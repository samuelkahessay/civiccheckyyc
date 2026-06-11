import Link from 'next/link'
import type { Candidate } from '@/lib/supabase'
import { ArrowRight, Check, Globe } from 'lucide-react'
import { TopicBadges } from './TopicBadges'
import { getCardClasses } from '@/lib/component-variants'
import { getTypographyClasses } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

interface CandidateCardProps {
  candidate: Candidate
  voteCount: number
  topTopics?: { topic: string; count: number }[]
  onTopicClick?: (topic: string) => void
  // Comparison mode
  isSelected?: boolean
  onToggleSelection?: (candidateId: string) => void
  selectionDisabled?: boolean
}

export function CandidateCard({
  candidate,
  voteCount,
  topTopics = [],
  onTopicClick,
  isSelected = false,
  onToggleSelection,
  selectionDisabled = false
}: CandidateCardProps) {
  const showCheckbox = !!onToggleSelection

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectionDisabled && onToggleSelection) {
      onToggleSelection(candidate.id)
    }
  }

  return (
    <Link href={`/candidates/${candidate.slug}`} className="group block relative">
      <div className={getCardClasses({
        padding: 'default',
        interactive: 'clickable',
        accent: isSelected ? 'selected' : 'none',
        className: cn('h-full border-l-[3px] border-l-red-600 dark:border-l-red-500')
      })}>
        {/* Selection Checkbox - Touch-friendly */}
        {showCheckbox && (
          <div
            className="absolute top-3 right-3 z-10"
            onClick={handleCheckboxClick}
          >
            <div className={cn(
              "min-w-[28px] min-h-[28px] rounded-md border-2 flex items-center justify-center cursor-pointer transition-all",
              isSelected
                ? 'bg-red-600 border-red-600'
                : selectionDisabled
                  ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-300 hover:border-red-500 dark:bg-gray-800 dark:border-gray-600'
            )}>
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}

        <div className="mb-3 md:mb-4">
          <h3 className={cn(
            getTypographyClasses('cardTitle'),
            "text-gray-900 dark:text-gray-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors pr-8"
          )}>
            {candidate.name}
          </h3>
          {candidate.current_role && (
            <p className={cn(getTypographyClasses('body'), "font-medium text-gray-600 dark:text-gray-400 mt-1")}>
              {candidate.current_role}
            </p>
          )}
        </div>

        {topTopics.length > 0 && (
          <div className="mb-3 md:mb-4">
            <div className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400 mb-2")}>
              Top voting areas:
            </div>
            <TopicBadges topics={topTopics} onTopicClick={onTopicClick} />
          </div>
        )}

        {voteCount === 0 && (
          <div className="mb-3 md:mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
            <p className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400")}>
              No council voting record &mdash; this candidate has not previously served on Calgary City Council.
            </p>
            {candidate.website && (
              <a
                href={candidate.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(getTypographyClasses('caption'), "inline-flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 hover:underline")}
              >
                <Globe className="w-3 h-3" />
                Campaign website
              </a>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-700">
          {voteCount > 0 ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums text-gray-900 dark:text-gray-50">
                {voteCount}
              </span>
              <span className={cn(getTypographyClasses('caption'), "text-gray-500 dark:text-gray-400")}>
                votes
              </span>
            </div>
          ) : (
            <span className={cn(getTypographyClasses('caption'), "text-gray-400 dark:text-gray-500 italic")}>
              No voting data available
            </span>
          )}
          <ArrowRight className="h-4 w-4 text-red-600 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  )
}
