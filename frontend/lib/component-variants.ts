/**
 * Component Variants using Class Variance Authority
 * Standardized styling for consistent UI components
 */

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

// ============================================
// CARD VARIANTS
// ============================================

/**
 * Standard card variants with consistent hover states and padding
 */
export const cardVariants = cva(
  // Base styles - always applied
  'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 transition-all duration-200',
  {
    variants: {
      // Padding variants
      padding: {
        none: '',
        sm: 'p-3 md:p-4',
        default: 'p-4 md:p-6',
        lg: 'p-6 md:p-8',
      },

      // Interactive state variants
      interactive: {
        none: '',
        clickable: 'cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-red-500/50 active:scale-[0.98]',
        hoverable: 'hover:shadow-lg hover:ring-2 hover:ring-red-500/50',
      },

      // Border accent variants
      accent: {
        none: '',
        selected: 'ring-2 ring-red-500 bg-red-50/50 dark:bg-red-900/10',
        success: 'border-l-4 border-l-green-500',
        warning: 'border-l-4 border-l-yellow-500',
        error: 'border-l-4 border-l-red-500',
      },
    },
    defaultVariants: {
      padding: 'default',
      interactive: 'none',
      accent: 'none',
    },
  }
)

export type CardVariantProps = VariantProps<typeof cardVariants>

// ============================================
// BADGE VARIANTS
// ============================================

/**
 * Unified badge variants for all badge types
 */
export const badgeVariants = cva(
  // Base styles
  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
  {
    variants: {
      // Vote badge variants
      vote: {
        for: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
        against: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        absent: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
      },

      // Confidence badge variants
      confidence: {
        ai_generated: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700',
        under_review: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
        verified: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700',
      },

      // Impact badge variants
      impact: {
        high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
        medium: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
        low: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700',
      },

      // Semantic badge variants
      semantic: {
        default: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600',
        primary: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
        success: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700',
        warning: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700',
        error: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
      },

      // Interactive variants
      interactive: {
        none: '',
        clickable: 'cursor-pointer hover:opacity-80',
      },
    },
    defaultVariants: {
      semantic: 'default',
      interactive: 'none',
    },
  }
)

export type BadgeVariantProps = VariantProps<typeof badgeVariants>

// ============================================
// BUTTON VARIANTS
// ============================================

/**
 * Button variants with touch targets and consistent states
 */
export const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900',
        secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
        outline: 'border-2 border-gray-300 bg-transparent hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800',
        ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      },

      size: {
        sm: 'px-3 py-1.5 text-sm min-h-[36px]',
        default: 'px-4 py-2 text-sm md:text-base min-h-[44px]',
        lg: 'px-6 py-3 text-base md:text-lg min-h-[48px]',
        icon: 'p-2 min-h-[44px] min-w-[44px]',
      },

      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
      fullWidth: false,
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

// ============================================
// INPUT VARIANTS
// ============================================

/**
 * Form input variants with touch-friendly sizing
 */
export const inputVariants = cva(
  // Base styles
  'w-full rounded-lg border bg-white px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-900 dark:border-gray-700',
  {
    variants: {
      size: {
        sm: 'min-h-[36px] text-sm',
        default: 'min-h-[44px] text-sm md:text-base',
        lg: 'min-h-[48px] text-base',
      },

      state: {
        default: 'border-gray-300 dark:border-gray-700',
        error: 'border-red-500 ring-2 ring-red-200 dark:ring-red-700/30',
        success: 'border-green-500 ring-2 ring-green-200 dark:ring-green-700/30',
      },
    },
    defaultVariants: {
      size: 'default',
      state: 'default',
    },
  }
)

export type InputVariantProps = VariantProps<typeof inputVariants>

// ============================================
// CHIP/TAG VARIANTS
// ============================================

/**
 * Small clickable chips/tags for filters
 */
export const chipVariants = cva(
  // Base styles
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 min-h-[32px]',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600',
        selected: 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-900/30 dark:text-red-100 dark:border-red-700',
        topic: 'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800',
      },

      interactive: {
        none: '',
        clickable: 'cursor-pointer hover:opacity-80 active:scale-95',
        removable: 'cursor-pointer hover:opacity-80',
      },
    },
    defaultVariants: {
      variant: 'default',
      interactive: 'none',
    },
  }
)

export type ChipVariantProps = VariantProps<typeof chipVariants>

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Compose card classes with custom className
 */
export function getCardClasses(
  props: CardVariantProps & { className?: string }
): string {
  const { className, ...variants } = props
  return cn(cardVariants(variants), className)
}

/**
 * Compose badge classes with custom className
 */
export function getBadgeClasses(
  props: BadgeVariantProps & { className?: string }
): string {
  const { className, ...variants } = props
  return cn(badgeVariants(variants), className)
}

/**
 * Compose button classes with custom className
 */
export function getButtonClasses(
  props: ButtonVariantProps & { className?: string }
): string {
  const { className, ...variants } = props
  return cn(buttonVariants(variants), className)
}

/**
 * Compose chip classes with custom className
 */
export function getChipClasses(
  props: ChipVariantProps & { className?: string }
): string {
  const { className, ...variants } = props
  return cn(chipVariants(variants), className)
}
