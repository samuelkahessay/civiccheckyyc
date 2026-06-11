'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useMemo, useCallback, useRef, useTransition, useEffect } from 'react'
import type { CandidateWithStats } from '@/lib/supabase'
import { CandidateFilters } from './CandidateFilters'
import { CandidateFeed } from './CandidateFeed'
import { parseArray, stringifyArray } from '@/lib/utils'
import { Card } from '@tremor/react'
import { GitCompare, X } from 'lucide-react'
import Link from 'next/link'
import { UnifiedBadge } from './UnifiedBadge'
import DSButton from './DSButton'

interface CandidatesPageClientProps {
  initialCandidates: CandidateWithStats[]
  filteredTotalCount: number
  topicStats: { topic: string; voteCount: number; candidateCount: number }[]
  totalCandidateCount: number
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

export function CandidatesPageClient({
  initialCandidates,
  filteredTotalCount,
  topicStats,
  totalCandidateCount
}: CandidatesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const PAGE_SIZE = 100

  // Client-side pagination state
  const [candidates, setCandidates] = useState<CandidateWithStats[]>(initialCandidates)
  const [loadedCount, setLoadedCount] = useState<number>(initialCandidates.length)
  const [hasMore, setHasMore] = useState<boolean>(initialCandidates.length < filteredTotalCount)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Comparison selection state
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(
    parseArray(searchParams.get('compare'))
  )

  // Parse URL params into state
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    topics: parseArray(searchParams.get('topics')),
  })

  // Sync state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      topics: parseArray(searchParams.get('topics')),
    })
    setSelectedCandidates(parseArray(searchParams.get('compare')))
  }, [searchParams])

  // When server provides new initial candidates (filters changed), reset pagination
  useEffect(() => {
    setCandidates(initialCandidates)
    setLoadedCount(initialCandidates.length)
    setHasMore(initialCandidates.length < filteredTotalCount)
    setLoadingMore(false)
  }, [initialCandidates, filteredTotalCount])

  // Sync filters to URL (use router.replace, not push!)
  const updateURL = useCallback((newFilters: typeof filters, newSelection?: string[]) => {
    const params = new URLSearchParams()

    if (newFilters.q) params.set('q', newFilters.q)
    if (newFilters.topics.length) params.set('topics', stringifyArray(newFilters.topics))
    // minVotes disabled for mayoral list

    // Add comparison selection to URL
    const selection = newSelection !== undefined ? newSelection : selectedCandidates
    if (selection.length > 0) params.set('compare', stringifyArray(selection))

    const queryString = params.toString()
    const newUrl = queryString ? `/candidates?${queryString}` : '/candidates'

    startTransition(() => {
      router.replace(newUrl, { scroll: false })
    })
  }, [router, selectedCandidates])

  // Debounced update (for search)
  const debouncedUpdate = useDebouncedCallback(updateURL, 400)

  // Filter logic (client-side safety filter, server does the heavy lifting)
  const filteredCandidates = useMemo(() => {
    let result = candidates

    if (filters.q) {
      const query = filters.q.toLowerCase()
      result = result.filter(c =>
        c.candidate.name?.toLowerCase().includes(query) ||
        c.candidate.bio?.toLowerCase().includes(query) ||
        c.candidate.current_role?.toLowerCase().includes(query)
      )
    }

    if (filters.topics.length) {
      result = result.filter(c =>
        c.topTopics.some(t => filters.topics.includes(t.topic))
      )
    }

    // minVotes disabled for mayoral list

    return result
  }, [candidates, filters])

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.topics.length) params.set('topics', filters.topics.join(','))
    // minVotes disabled for mayoral list
    params.set('offset', String(loadedCount))
    params.set('limit', String(PAGE_SIZE))

    try {
      const res = await fetch(`/api/candidates?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      const newItems: CandidateWithStats[] = json.candidates || []
      setCandidates(prev => [...prev, ...newItems])
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
    const clearedFilters = { q: '', topics: [] }
    setFilters(clearedFilters)
    router.replace('/candidates')
  }, [router])

  // Comparison selection handlers
  const toggleCandidateSelection = useCallback((candidateId: string) => {
    const newSelection = selectedCandidates.includes(candidateId)
      ? selectedCandidates.filter(id => id !== candidateId)
      : selectedCandidates.length < 4
        ? [...selectedCandidates, candidateId]
        : selectedCandidates

    setSelectedCandidates(newSelection)
    updateURL(filters, newSelection)
  }, [selectedCandidates, filters, updateURL])

  const clearSelection = useCallback(() => {
    setSelectedCandidates([])
    updateURL(filters, [])
  }, [filters, updateURL])

  const compareUrl = selectedCandidates.length >= 2
    ? `/compare?candidates=${selectedCandidates.join(',')}`
    : null

  // Active filters for display
  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string }> = []
    if (filters.q) list.push({ key: 'q', label: `Search: "${filters.q}"` })
    if (filters.topics.length > 0) list.push({ key: 'topics', label: `${filters.topics.length} topic(s)` })
    // minVotes disabled for mayoral list
    return list
  }, [filters])

  const removeFilter = useCallback((key: string) => {
    let newFilters = { ...filters }
    if (key === 'q') newFilters.q = ''
    if (key === 'topics') newFilters.topics = []
    // minVotes disabled for mayoral list
    setFilters(newFilters)
    updateURL(newFilters)
  }, [filters, updateURL])

  return (
    <>
      <CandidateFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        topicStats={topicStats}
        onClearAll={clearAll}
        showMinVotes={false}
      />

      {/* Results count */}
      <div className="mb-6" aria-live="polite" aria-atomic="true">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing <strong>{filteredCandidates.length}</strong> of{' '}
          <strong>{filteredTotalCount}</strong> matching candidates
          {totalCandidateCount > filteredTotalCount && (
            <span className="text-gray-500"> ({totalCandidateCount.toLocaleString()} all-time)</span>
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

      <CandidateFeed
        candidates={filteredCandidates}
        onTopicClick={handleTopicClick}
        onToggleSelection={toggleCandidateSelection}
        selectedCandidates={selectedCandidates}
        selectionDisabled={selectedCandidates.length >= 4}
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

      {/* Sticky comparison bar at bottom */}
      {selectedCandidates.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 shadow-lg">
          <Card className="rounded-none border-x-0 border-b-0">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitCompare className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? 's' : ''} selected
                  {selectedCandidates.length === 1 && ' (select at least 2)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DSButton
                  variant="secondary"
                  size="xs"
                  onClick={clearSelection}
                  icon={X}
                >
                  Clear
                </DSButton>
                {compareUrl ? (
                  <Link href={compareUrl}>
                    <DSButton size="xs">
                      Compare {selectedCandidates.length} Candidates
                    </DSButton>
                  </Link>
                ) : (
                  <DSButton size="xs" disabled>
                    Compare Candidates
                  </DSButton>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
