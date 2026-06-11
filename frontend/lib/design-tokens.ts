/**
 * Design Tokens for CivicCheckYYC
 * Mobile-first design system constants
 */

// ============================================
// SPACING SCALE (based on 4px grid)
// ============================================
export const spacing = {
  xs: '4px',    // 0.25rem - tight spacing
  sm: '8px',    // 0.5rem - compact spacing
  md: '12px',   // 0.75rem - cozy spacing
  base: '16px', // 1rem - default spacing
  lg: '24px',   // 1.5rem - comfortable spacing
  xl: '32px',   // 2rem - spacious
  '2xl': '48px', // 3rem - generous
  '3xl': '64px', // 4rem - very spacious
} as const

// ============================================
// TOUCH TARGETS (WCAG 2.5.5 Level AAA)
// ============================================
export const touchTarget = {
  minimum: '44px', // Minimum touch target size for mobile
  comfortable: '48px', // Comfortable touch target
  spacious: '56px', // Spacious touch target for primary actions
} as const

// ============================================
// TYPOGRAPHY SCALE (Mobile-First)
// ============================================
export const typography = {
  // Page titles (H1)
  pageTitle: {
    mobile: 'text-2xl',   // 24px
    tablet: 'md:text-3xl', // 30px
    desktop: 'lg:text-4xl', // 36px
    weight: 'font-bold',
    tracking: 'tracking-tight',
  },

  // Section headers (H2)
  sectionHeader: {
    mobile: 'text-xl',    // 20px
    tablet: 'md:text-2xl', // 24px
    desktop: 'lg:text-3xl', // 30px
    weight: 'font-bold',
    tracking: 'tracking-tight',
  },

  // Card titles (H3)
  cardTitle: {
    mobile: 'text-lg',    // 18px
    tablet: 'md:text-xl', // 20px
    weight: 'font-semibold',
    leading: 'leading-snug',
  },

  // Component headers
  componentHeader: {
    mobile: 'text-base',  // 16px
    tablet: 'md:text-lg', // 18px
    weight: 'font-semibold',
  },

  // Body text
  body: {
    mobile: 'text-sm',    // 14px
    tablet: 'md:text-base', // 16px
    leading: 'leading-relaxed',
  },

  // Stat numbers (dashboard figures)
  statNumber: {
    mobile: 'text-3xl',      // 30px
    tablet: 'md:text-4xl',   // 36px
    desktop: 'lg:text-5xl',  // 48px
    weight: 'font-black',
    tracking: 'tracking-tight',
  },

  // Small text / captions
  caption: {
    mobile: 'text-xs',    // 12px
    tablet: 'md:text-sm', // 14px
  },

  // Tiny text (use sparingly)
  tiny: {
    mobile: 'text-xs',    // 12px
  },
} as const

// ============================================
// BREAKPOINTS (Tailwind defaults)
// ============================================
export const breakpoints = {
  sm: '640px',  // Small tablets
  md: '768px',  // Tablets
  lg: '1024px', // Laptops
  xl: '1280px', // Desktops
  '2xl': '1536px', // Large desktops
} as const

// ============================================
// CONTAINER WIDTHS
// ============================================
export const containers = {
  narrow: 'max-w-4xl',   // Candidate detail, compare page
  default: 'max-w-6xl',  // Default page width
  wide: 'max-w-7xl',     // Dashboard, wide layouts
  full: 'max-w-full',    // Full width
} as const

// ============================================
// COMPONENT SPACING
// ============================================
export const componentSpacing = {
  // Card padding
  cardPadding: {
    mobile: 'p-4',       // 16px
    desktop: 'md:p-6',   // 24px
  },

  // Section spacing (margin bottom)
  sectionSpacing: {
    mobile: 'mb-6',      // 24px
    desktop: 'md:mb-8',  // 32px
  },

  // Component gap (between elements)
  gap: {
    tight: 'gap-2',      // 8px
    normal: 'gap-4',     // 16px
    comfortable: 'gap-6', // 24px
  },

  // Grid gap
  gridGap: 'gap-6',      // 24px consistent
} as const

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
  sm: 'rounded-md',      // 6px - small elements
  default: 'rounded-lg', // 8px - cards, buttons
  card: 'rounded-lg',    // 8px - cards
  full: 'rounded-full',  // Pills, avatars
} as const

// ============================================
// SHADOWS
// ============================================
export const shadows = {
  sm: 'shadow-sm',
  default: 'shadow',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
} as const

// ============================================
// Z-INDEX LAYERS
// ============================================
export const zIndex = {
  navigation: 50,        // Sticky navigation
  filters: 40,           // Sticky filters
  floatingBar: 50,       // Floating comparison bar
  modal: 60,             // Modals
  dropdown: 50,          // Dropdowns
  tooltip: 70,           // Tooltips
} as const

// ============================================
// TRANSITIONS
// ============================================
export const transitions = {
  fast: 'duration-150',
  default: 'duration-200',
  slow: 'duration-300',
  easing: 'ease-in-out',
  all: 'transition-all',
  colors: 'transition-colors',
  transform: 'transition-transform',
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get responsive typography classes
 */
export function getTypographyClasses(variant: keyof typeof typography): string {
  const config = typography[variant]
  const classes: string[] = [config.mobile]

  if ('tablet' in config) classes.push(config.tablet)
  if ('desktop' in config) classes.push(config.desktop)
  if ('weight' in config) classes.push(config.weight)
  if ('tracking' in config) classes.push(config.tracking)
  if ('leading' in config) classes.push(config.leading)

  return classes.join(' ')
}

/**
 * Get card padding classes
 */
export function getCardPaddingClasses(): string {
  return `${componentSpacing.cardPadding.mobile} ${componentSpacing.cardPadding.desktop}`
}

/**
 * Get section spacing classes
 */
export function getSectionSpacingClasses(): string {
  return `${componentSpacing.sectionSpacing.mobile} ${componentSpacing.sectionSpacing.desktop}`
}

/**
 * Get minimum touch target classes
 */
export function getTouchTargetClasses(size: keyof typeof touchTarget = 'minimum'): string {
  return `min-h-[${touchTarget[size]}] min-w-[${touchTarget[size]}]`
}

/**
 * Get standard transition classes
 */
export function getTransitionClasses(type: 'all' | 'colors' | 'transform' = 'all'): string {
  return `${transitions[type]} ${transitions.default} ${transitions.easing}`
}
