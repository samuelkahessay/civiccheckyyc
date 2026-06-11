import { TopicBadge } from './UnifiedBadge'
import { formatTopicName } from '@/lib/utils'

interface TopicBadgesProps {
  topics: { topic: string; count: number }[]
  onTopicClick?: (topic: string) => void
}

export function TopicBadges({ topics, onTopicClick }: TopicBadgesProps) {
  if (topics.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map(({ topic, count }) => (
        onTopicClick ? (
          <button
            key={topic}
            onClick={() => onTopicClick(topic)}
            className="inline-block"
          >
            <TopicBadge topic={formatTopicName(topic)} count={count} />
          </button>
        ) : (
          <span key={topic} className="inline-block">
            <TopicBadge topic={formatTopicName(topic)} count={count} />
          </span>
        )
      ))}
    </div>
  )
}
