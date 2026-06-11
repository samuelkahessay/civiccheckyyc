/**
 * VoteBadge - Displays data confidence level
 * Now uses UnifiedBadge for consistency
 */

import { ConfidenceBadge } from './UnifiedBadge'

interface VoteBadgeProps {
  confidence: 'ai_generated' | 'under_review' | 'verified'
}

export function VoteBadge({ confidence }: VoteBadgeProps) {
  return <ConfidenceBadge confidenceType={confidence} />
}
