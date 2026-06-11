'use client'
import { formatTopicName } from '@/lib/utils'
import { getTopicDotClass } from '@/lib/topicColors'
import { getChipClasses } from '@/lib/component-variants'
import { X } from 'lucide-react'

interface TopicFilterChipsProps {
  topics: { topic: string; voteCount: number; candidateCount: number }[]
  selectedTopics: string[]
  onToggleTopic: (topic: string) => void
}

export function TopicFilterChips({ topics, selectedTopics, onToggleTopic }: TopicFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 md:gap-2">
      {topics.map(({ topic, voteCount }) => {
        const isSelected = selectedTopics.includes(topic)
        const classes = getChipClasses({
          variant: isSelected ? 'selected' : 'default',
          interactive: 'clickable',
        })
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onToggleTopic(topic)}
            className={classes}
          >
            {isSelected && <X className="w-4 h-4 md:w-3 md:h-3" />}
            <span className={`w-2 h-2 rounded-full ${getTopicDotClass(topic)}`} aria-hidden="true" />
            <span>{formatTopicName(topic)}</span>
            <span className={`text-xs ${isSelected ? 'text-red-900 dark:text-red-100' : 'text-gray-500 dark:text-gray-400'}`}>
              ({voteCount})
            </span>
          </button>
        )
      })}
    </div>
  )
}
