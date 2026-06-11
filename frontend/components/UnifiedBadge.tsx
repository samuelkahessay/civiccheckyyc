/**
 * UnifiedBadge Component
 * A single, consistent badge component that replaces all badge variations
 * Supports vote, confidence, impact, and semantic variants
 */

import React from 'react'
import { badgeVariants, type BadgeVariantProps } from '@/lib/component-variants'
import { cn } from '@/lib/utils'
import { Flame, Zap, FileText, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { getTopicBadgeClasses } from '@/lib/topicColors'

// ============================================
// TYPES
// ============================================

type VoteType = 'for' | 'against' | 'absent'
type ConfidenceType = 'ai_generated' | 'under_review' | 'verified'
type ImpactType = 'high' | 'medium' | 'low'
type SemanticType = 'default' | 'primary' | 'success' | 'warning' | 'error'

interface BaseUnifiedBadgeProps {
  className?: string
  onClick?: (e: React.MouseEvent) => void
  children?: React.ReactNode
}

// Vote badge props
interface VoteBadgeProps extends BaseUnifiedBadgeProps {
  variant: 'vote'
  voteType: VoteType
  showIcon?: boolean
}

// Confidence badge props
interface ConfidenceBadgeProps extends BaseUnifiedBadgeProps {
  variant: 'confidence'
  confidenceType: ConfidenceType
}

// Impact badge props
interface ImpactBadgeProps extends BaseUnifiedBadgeProps {
  variant: 'impact'
  impactType: ImpactType
  showIcon?: boolean
}

// Semantic badge props
interface SemanticBadgeProps extends BaseUnifiedBadgeProps {
  variant?: 'semantic'
  semanticType?: SemanticType
}

// Topic badge props (special case of semantic)
interface TopicBadgeProps extends BaseUnifiedBadgeProps {
  variant: 'topic'
  topic: string
  count?: number
}

export type UnifiedBadgeProps =
  | VoteBadgeProps
  | ConfidenceBadgeProps
  | ImpactBadgeProps
  | SemanticBadgeProps
  | TopicBadgeProps

// ============================================
// ICON MAPS
// ============================================

const voteIcons = {
  for: CheckCircle,
  against: XCircle,
  absent: MinusCircle,
}

const impactIcons = {
  high: Flame,
  medium: Zap,
  low: FileText,
}

const voteLabels = {
  for: 'FOR',
  against: 'AGAINST',
  absent: 'ABSENT',
}

const confidenceLabels = {
  ai_generated: 'AI Generated',
  under_review: 'Under Review',
  verified: 'Verified',
}

const impactLabels = {
  high: 'High Impact',
  medium: 'Medium Impact',
  low: 'Low Impact',
}

// ============================================
// COMPONENT
// ============================================

export function UnifiedBadge(props: UnifiedBadgeProps) {
  const { className, onClick, children } = props

  // Determine variant props for CVA
  let variantProps: BadgeVariantProps = {
    interactive: onClick ? 'clickable' : 'none',
  }

  let content: React.ReactNode = children
  let icon: React.ReactNode = null

  // Vote variant
  if (props.variant === 'vote') {
    variantProps = { ...variantProps, vote: props.voteType }
    content = children || voteLabels[props.voteType]

    if (props.showIcon) {
      const IconComponent = voteIcons[props.voteType]
      icon = <IconComponent className="w-3 h-3" />
    }
  }

  // Confidence variant
  else if (props.variant === 'confidence') {
    variantProps = { ...variantProps, confidence: props.confidenceType }
    content = children || confidenceLabels[props.confidenceType]
  }

  // Impact variant
  else if (props.variant === 'impact') {
    variantProps = { ...variantProps, impact: props.impactType }
    content = children || impactLabels[props.impactType]

    if (props.showIcon) {
      const IconComponent = impactIcons[props.impactType]
      icon = <IconComponent className="w-3 h-3" />
    }
  }

  // Topic variant (uses semantic primary styling)
  else if (props.variant === 'topic') {
    variantProps = { ...variantProps, semantic: 'default' }
    content = props.count !== undefined ? `${props.topic} (${props.count})` : props.topic
  }

  // Semantic variant (default)
  else {
    variantProps = { ...variantProps, semantic: props.semanticType || 'default' }
  }

  const Component = onClick ? 'button' : 'span'

  // For topic badges, add color classes derived from the topic mapping
  const extraClass = (props as any).variant === 'topic' ? getTopicBadgeClasses((props as any).topic) : ''

  return (
    <Component
      onClick={onClick}
      className={cn(badgeVariants(variantProps), extraClass, className)}
      type={onClick ? 'button' : undefined}
      aria-label={typeof content === 'string' ? content : undefined}
    >
      {icon}
      {content}
    </Component>
  )
}

// ============================================
// CONVENIENCE COMPONENTS
// ============================================

/**
 * Vote Badge - for displaying vote positions
 */
export function VoteBadge({
  voteType,
  showIcon = false,
  className,
  ...props
}: Omit<VoteBadgeProps, 'variant'>) {
  return (
    <UnifiedBadge
      variant="vote"
      voteType={voteType}
      showIcon={showIcon}
      className={className}
      {...props}
    />
  )
}

/**
 * Confidence Badge - for data confidence levels
 */
export function ConfidenceBadge({
  confidenceType,
  className,
  ...props
}: Omit<ConfidenceBadgeProps, 'variant'>) {
  return (
    <UnifiedBadge
      variant="confidence"
      confidenceType={confidenceType}
      className={className}
      {...props}
    />
  )
}

/**
 * Impact Badge - for motion impact levels
 */
export function ImpactBadge({
  impactType,
  showIcon = true,
  className,
  ...props
}: Omit<ImpactBadgeProps, 'variant'>) {
  return (
    <UnifiedBadge
      variant="impact"
      impactType={impactType}
      showIcon={showIcon}
      className={className}
      {...props}
    />
  )
}

/**
 * Topic Badge - for displaying topics
 */
export function TopicBadge({
  topic,
  count,
  onClick,
  className,
  ...props
}: Omit<TopicBadgeProps, 'variant'>) {
  return (
    <UnifiedBadge
      variant="topic"
      topic={topic}
      count={count}
      onClick={onClick}
      className={className}
      {...props}
    />
  )
}
