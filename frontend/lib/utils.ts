/**
 * Utility functions for CivicCheckYYC
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and tailwind-merge
 * Used for merging Tailwind CSS classes properly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tremor Raw cx [v0.0.0]
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focusInput [v0.0.2]
export const focusInput = [
  // base
  "focus:ring-2",
  // ring color
  "focus:ring-red-200 dark:focus:ring-red-700/30",
  // border color
  "focus:border-red-500 dark:focus:border-red-700",
]

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
  // base
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  // outline color
  "outline-red-500 dark:outline-red-500",
]

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
  // base
  "ring-2",
  // border color
  "border-red-500 dark:border-red-700",
  // ring color
  "ring-red-200 dark:ring-red-700/30",
]

/**
 * Format topic names from camelCase to user-friendly format with spaces
 *
 * Examples:
 * - "IndigenousRelations" → "Indigenous Relations"
 * - "PublicSafety" → "Public Safety"
 * - "EconomicDevelopment" → "Economic Development"
 * - "Housing" → "Housing"
 *
 * @param topic - The topic in camelCase format
 * @returns The formatted topic with spaces
 */
export function formatTopicName(topic: string | null | undefined): string {
  if (!topic) return 'Other'

  // Special cases where we want specific formatting
  const specialCases: Record<string, string> = {
    'IndigenousRelations': 'Indigenous Relations',
    'PublicSafety': 'Public Safety',
    'EconomicDevelopment': 'Economic Development',
    'SocialServices': 'Social Services',
    'IntergovernmentalAffairs': 'Intergovernmental Affairs',
  }

  // Check if we have a special case mapping
  if (specialCases[topic]) {
    return specialCases[topic]
  }

  // For other topics, insert spaces before capital letters
  // This handles cases like "Housing", "Transit", "Budget", etc. (no change)
  // and "Planning" → "Planning" (no change)
  return topic.replace(/([A-Z])/g, ' $1').trim()
}

/**
 * Get all unique topics from a list of votes and format them
 * @param votes - List of votes
 * @returns Array of formatted unique topics
 */
export function getUniqueTopics(votes: { topic: string | null }[]): string[] {
  const topicsSet = new Set<string>()

  votes.forEach(vote => {
    if (vote.topic) {
      topicsSet.add(vote.topic)
    }
  })

  return Array.from(topicsSet).sort()
}

/**
 * Parse comma-separated URL parameter into array
 * @param param - URL parameter value
 * @returns Array of strings (empty array if param is null/empty)
 */
export function parseArray(param: string | null | undefined): string[] {
  if (!param) return []
  return param.split(',').filter(Boolean)
}

/**
 * Stringify array into comma-separated string for URL
 * @param arr - Array of strings
 * @returns Comma-separated string
 */
export function stringifyArray(arr: string[]): string {
  return arr.join(',')
}
