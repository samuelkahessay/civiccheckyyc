import { format } from 'date-fns'
import Link from 'next/link'

interface OverviewStatsProps {
  totalVotes: number
  totalMotions: number
  highImpactCount: number
  activeCandidates: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
}

export function OverviewStats({
  totalVotes,
  totalMotions,
  highImpactCount,
  activeCandidates,
  dateRange,
}: OverviewStatsProps) {
  const dateLabel =
    dateRange.earliest && dateRange.latest
      ? `${format(new Date(dateRange.earliest), 'MMM yyyy')} – ${format(new Date(dateRange.latest), 'MMM yyyy')}`
      : 'N/A'

  return (
    <div className="bg-red-700 dark:bg-red-900 rounded-lg px-6 py-5 mb-6 md:mb-8">
      <div className="grid grid-cols-2 md:flex md:items-baseline md:justify-between gap-y-4 gap-x-6">
        <Link href="/motions" className="group text-center md:text-left">
          <div className="text-3xl md:text-4xl font-black tabular-nums text-white">
            {totalVotes.toLocaleString()}
          </div>
          <div className="text-sm font-normal text-white/80 group-hover:text-white transition-colors">
            Total Votes
          </div>
        </Link>

        <Link href="/motions" className="group text-center md:text-left">
          <div className="text-3xl md:text-4xl font-black tabular-nums text-white">
            {totalMotions.toLocaleString()}
          </div>
          <div className="text-sm font-normal text-white/80 group-hover:text-white transition-colors">
            Council Motions
          </div>
        </Link>

        <Link href="/motions?impact=high" className="group text-center md:text-left">
          <div className="text-3xl md:text-4xl font-black tabular-nums text-white">
            {highImpactCount.toLocaleString()}
          </div>
          <div className="text-sm font-normal text-white/80 group-hover:text-white transition-colors">
            High-Impact
          </div>
        </Link>

        <div className="text-center md:text-left">
          <div className="text-3xl md:text-4xl font-black tabular-nums text-white">
            {activeCandidates}
          </div>
          <div className="text-sm font-normal text-white/80">
            Candidates
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 text-center md:text-right border-t border-white/20 pt-3 md:border-t-0 md:pt-0">
          <div className="text-sm font-normal text-white/80">
            {dateLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
