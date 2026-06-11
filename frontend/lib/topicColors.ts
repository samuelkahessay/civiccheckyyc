// Shared topic color utilities to keep colors consistent across charts and badges

// Tailwind/Tremor color keywords we support
export const TOPIC_COLOR_PALETTE = [
  'blue',
  'orange',
  'emerald',
  'rose',
  'cyan',
  'violet',
  'amber',
  'teal',
  'indigo',
  'pink',
  'lime',
  'green',
  'red',
] as const

export type TopicColor = (typeof TOPIC_COLOR_PALETTE)[number]

export function normalizeTopicKey(topic: string): string {
  return (topic || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Stable, curated mapping for common topics
const STATIC_TOPIC_COLOR_MAP: Record<string, TopicColor> = {
  planning: 'blue',
  governance: 'cyan',
  budget: 'amber',
  intergovernmentalaffairs: 'indigo',
  transit: 'violet',
  infrastructure: 'emerald',
  publicsafety: 'rose',
  housing: 'orange',
  environment: 'green',
  economicdevelopment: 'red',
  socialservices: 'teal',
  indigenousrelations: 'lime',
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Get a color keyword for a topic; uses static mapping when available,
// otherwise falls back to a stable hash across the palette.
export function getTopicColor(topic: string): TopicColor {
  const key = normalizeTopicKey(topic)
  if (STATIC_TOPIC_COLOR_MAP[key]) return STATIC_TOPIC_COLOR_MAP[key]
  const idx = hashString(key) % TOPIC_COLOR_PALETTE.length
  return TOPIC_COLOR_PALETTE[idx]
}

// Tailwind utility builders for badges (light + dark)
export function getTopicBadgeClasses(topic: string): string {
  const color = getTopicColor(topic)
  return [
    `bg-${color}-50`,
    `text-${color}-800`,
    `border-${color}-200`,
    `dark:bg-${color}-950/30`,
    `dark:text-${color}-200`,
    `dark:border-${color}-800`,
  ].join(' ')
}

export function getTopicDotClass(topic: string): string {
  const color = getTopicColor(topic)
  return `bg-${color}-500`
}

