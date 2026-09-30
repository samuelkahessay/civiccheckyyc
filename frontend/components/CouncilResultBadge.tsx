import { UnifiedBadge } from '@/components/UnifiedBadge'
import type { Motion } from '@/lib/localData'

/**
 * Whole-council outcome from Calgary Open Data. The vote bars next to it only
 * count the tracked candidates, so the council result is what says whether the
 * motion passed.
 */
export function CouncilResultBadge({ motion }: { motion: Pick<Motion, 'council_result' | 'council_for' | 'council_against'> }) {
  if (!motion.council_result) return null
  const tally =
    motion.council_for !== null && motion.council_against !== null
      ? ` ${motion.council_for}–${motion.council_against}`
      : ''
  return (
    <UnifiedBadge semanticType={motion.council_result === 'Carried' ? 'success' : 'error'}>
      Council: {motion.council_result}{tally}
    </UnifiedBadge>
  )
}
