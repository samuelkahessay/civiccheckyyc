import { cn } from '@/lib/utils'
import { getTypographyClasses, getSectionSpacingClasses } from '@/lib/design-tokens'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800', className)} />
}

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6">
      <div className="mb-2 flex items-center justify-center gap-2">
        <Skeleton className="w-5 h-5 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-16 mx-auto" />
    </div>
  )
}

function MotionCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6 h-full">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-5 w-3/4 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

function CandidateCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6 h-full">
      <div className="mb-4 md:mb-6">
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  )
}

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className={cn('text-center', getSectionSpacingClasses())}>
            <Skeleton className="h-10 w-80 mx-auto mb-4 md:mb-6" />
            <Skeleton className="h-6 w-48 mx-auto mb-3" />
            <Skeleton className="h-5 w-64 mx-auto" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 md:mb-12">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Recent Motions */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <MotionCardSkeleton key={i} />
              ))}
            </div>
          </div>

          {/* Topics */}
          <div className="mb-12">
            <Skeleton className="h-8 w-40 mb-6" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </div>

          {/* Candidates */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CandidateCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
