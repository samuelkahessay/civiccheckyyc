'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useMemo, useCallback, useRef, useTransition, useEffect } from 'react'
import type { MotionWithVotes, Candidate } from '@/lib/localData'
import { MotionFilters } from './MotionFilters'
import { MotionFeed } from './MotionFeed'
import { parseArray, stringifyArray } from '@/lib/utils'
import { UnifiedBadge } from './UnifiedBadge'

interface MotionsPageClientProps {
  initialMotions: MotionWithVotes[]
  filteredTotalCount: number
  topicStats: { topic: string; motionCount: number }[]
  candidates: Candidate[]
  totalMotionCount: number
}

// Debounce hook
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

export function MotionsPageClient({
  initialMotions,
  filteredTotalCount,
  topicStats,
  candidates,
  totalMotionCount
}: MotionsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const PAGE_SIZE = 120

  // Client-side pagination state
  const [motions, setMotions] = useState<MotionWithVotes[]>(initialMotions)
  const [loadedCount, setLoadedCount] = useState<number>(initialMotions.length)
  const [hasMore, setHasMore] = useState<boolean>(initialMotions.length < filteredTotalCount)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Parse URL params into state
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    topics: parseArray(searchParams.get('topics')),
    candidates: parseArray(searchParams.get('candidates')),
    impactHigh: searchParams.get('impact') === 'high'
  })

  // Sync state when URL changes (e.g., browser back/forward, direct navigation)
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      topics: parseArray(searchParams.get('topics')),
      candidates: parseArray(searchParams.get('candidates')),
      impactHigh: searchParams.get('impact') === 'high'
    })
  }, [searchParams])

  // When server provides new initial motions (filters changed), reset pagination
  useEffect(() => {
    setMotions(initialMotions)
    setLoadedCount(initialMotions.length)
    setHasMore(initialMotions.length < filteredTotalCount)
    setLoadingMore(false)
  }, [initialMotions, filteredTotalCount])

  // Sync filters to URL (use router.replace, not push!)
  const updateURL = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams()

    if (newFilters.q) params.set('q', newFilters.q)
    if (newFilters.topics.length) params.set('topics', stringifyArray(newFilters.topics))
    if (newFilters.candidates.length) params.set('candidates', stringifyArray(newFilters.candidates))
    if (newFilters.impactHigh) params.set('impact', 'high')

    const queryString = params.toString()
    const newUrl = queryString ? `/motions?${queryString}` : '/motions'

    startTransition(() => {
      router.replace(newUrl, { scroll: false })
    })
  }, [router])

  // Debounced update (for search)
  const debouncedUpdate = useDebouncedCallback(updateURL, 400)

  // Filter logic
  const filteredMotions = useMemo(() => {
    // Filtering is now done on the server; keep this local filter as a safety
    let result = motions

    if (filters.q) {
      const query = filters.q.toLowerCase()
      result = result.filter(m =>
        m.motion_summary?.toLowerCase().includes(query) ||
        m.resolution?.toLowerCase().includes(query) ||
        m.topic?.toLowerCase().includes(query)
      )
    }

    if (filters.topics.length) {
      result = result.filter(m => filters.topics.includes(m.topic || ''))
    }

    if (filters.impactHigh) {
      result = result.filter(m => m.impact === 'high')
    }

    if (filters.candidates.length) {
      result = result.filter(m =>
        m.votes?.some(v => filters.candidates.includes(v.candidate_id))
      )
    }

    return result
  }, [motions, filters])

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.topics.length) params.set('topics', filters.topics.join(','))
    if (filters.candidates.length) params.set('candidates', filters.candidates.join(','))
    if (filters.impactHigh) params.set('impact', 'high')
    params.set('offset', String(loadedCount))
    params.set('limit', String(PAGE_SIZE))

    try {
      const res = await fetch(`/api/motions?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      const newItems: MotionWithVotes[] = json.motions || []
      setMotions(prev => [...prev, ...newItems])
      setLoadedCount(prev => prev + newItems.length)
      const total = typeof json.total === 'number' ? json.total : filteredTotalCount
      setHasMore(prev => (loadedCount + newItems.length) < total)
    } catch (e) {
      // no-op
    } finally {
      setLoadingMore(false)
    }
  }, [filters, loadedCount, PAGE_SIZE, loadingMore, hasMore, filteredTotalCount])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadMore()
        }
      })
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // Topic click handler (preserves other filters)
  const handleTopicClick = useCallback((topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic]

    const newFilters = { ...filters, topics: newTopics }
    setFilters(newFilters)
    updateURL(newFilters)
  }, [filters, updateURL])

  // Candidate chip click handler (toggle candidate filter)
  const handleCandidateClick = useCallback((candidateId: string) => {
    const newCandidates = filters.candidates.includes(candidateId)
      ? filters.candidates.filter(id => id !== candidateId)
      : [...filters.candidates, candidateId]

    const newFilters = { ...filters, candidates: newCandidates }
    setFilters(newFilters)
    updateURL(newFilters)
  }, [filters, updateURL])

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters)

    // Debounce search, instant update for others
    if (newFilters.q !== filters.q) {
      debouncedUpdate(newFilters)
    } else {
      updateURL(newFilters)
    }
  }, [filters, updateURL, debouncedUpdate])

  // Clear all filters
  const clearAll = useCallback(() => {
    const clearedFilters = { q: '', topics: [], candidates: [], impactHigh: false }
    setFilters(clearedFilters)
    router.replace('/motions')
  }, [router])

  // Active filters for display (memoized)
  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string }> = []
    if (filters.q) list.push({ key: 'q', label: `Search: "${filters.q}"` })
    if (filters.topics.length > 0) list.push({ key: 'topics', label: `${filters.topics.length} topic(s)` })
    if (filters.candidates.length > 0) list.push({ key: 'candidates', label: `${filters.candidates.length} candidate(s)` })
    if (filters.impactHigh) list.push({ key: 'impact', label: 'High impact' })
    return list
  }, [filters])

  const removeFilter = useCallback((key: string) => {
    let newFilters = { ...filters }
    if (key === 'q') newFilters.q = ''
    if (key === 'topics') newFilters.topics = []
    if (key === 'candidates') newFilters.candidates = []
    if (key === 'impact') newFilters.impactHigh = false
    setFilters(newFilters)
    updateURL(newFilters)
  }, [filters, updateURL])

  return (
    <>
      <MotionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        topicStats={topicStats}
        candidates={candidates}
        onClearAll={clearAll}
      />

      {/* Results count with aria-live */}
      <div className="mb-6" aria-live="polite" aria-atomic="true">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing <strong>{filteredMotions.length}</strong> of{' '}
          <strong>{filteredTotalCount}</strong> matching motions
          {totalMotionCount > filteredTotalCount && (
            <span className="text-gray-500"> ({totalMotionCount.toLocaleString()} all-time)</span>
          )}
        </p>

        {/* Active filters summary */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeFilters.map(filter => (
              <UnifiedBadge key={filter.key} className="inline-flex items-center gap-1.5">
                {filter.label}
                <button
                  onClick={() => removeFilter(filter.key)}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  ×
                </button>
              </UnifiedBadge>
            ))}
          </div>
        )}
      </div>

      <MotionFeed
        motions={filteredMotions}
        onTopicClick={handleTopicClick}
        onCandidateClick={handleCandidateClick}
        loading={isPending || loadingMore}
      />

      {/* Load more controls */}
      <div className="flex items-center justify-center mt-8">
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 min-h-[44px]"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : (
          <span className="text-sm text-gray-500">No more results</span>
        )}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </>
  )
}
