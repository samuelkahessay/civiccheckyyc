import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800', className)} />
}

function VoteRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
      <Skeleton className="h-6 w-16 rounded-md" />
      <div className="flex-1">
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
  )
}

export default function CandidateDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Candidate Header Card */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6 mb-6 md:mb-8">
            <Skeleton className="h-10 w-64 mb-2 md:mb-3" />
            <Skeleton className="h-6 w-48 mb-3 md:mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <Skeleton className="h-4 w-12 mb-3" />
              <div className="flex gap-3">
                <Skeleton className="h-11 w-40 rounded-lg" />
                <Skeleton className="h-11 w-32 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Voting Summary Cards */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6 mb-6 md:mb-8">
            <Skeleton className="h-7 w-48 mb-4" />
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-4 w-8 mx-auto" />
              </div>
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-4 w-10 mx-auto" />
              </div>
            </div>

            {/* Vote breakdown bar */}
            <Skeleton className="h-3 w-full rounded-full mb-6" />

            {/* Topic chart placeholder */}
            <Skeleton className="h-7 w-40 mb-4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>

          {/* Voting Record List */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 md:p-6">
            <Skeleton className="h-7 w-36 mb-4" />
            {Array.from({ length: 8 }).map((_, i) => (
              <VoteRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
