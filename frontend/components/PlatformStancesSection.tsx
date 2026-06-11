"use client"

import { Card, Divider } from '@tremor/react'
import { ExternalLink, Quote, Tag } from 'lucide-react'
import Link from 'next/link'
import type { PlatformStance } from '@/lib/supabase'
import { UnifiedBadge } from './UnifiedBadge'

interface PlatformStancesSectionProps {
  stances: PlatformStance[]
}

export function PlatformStancesSection({ stances }: PlatformStancesSectionProps) {
  if (!stances || stances.length === 0) return null

  return (
    <Card className="mb-6 md:mb-8 p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-5 h-5 text-red-600" />
        <h2 className="text-xl font-semibold">Platform (Campaign)</h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        AI‑extracted platform points from the candidate’s campaign website. Each quote links to the exact source on their site.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {stances.map((s) => (
          <div key={s.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold mb-1">{s.title}</div>
                {s.topic && (
                  <div className="mb-2">
                    <UnifiedBadge>{s.topic}</UnifiedBadge>
                  </div>
                )}
              </div>
              <a
                href={s.source_scroll_url || s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 text-sm inline-flex items-center gap-1 hover:underline"
              >
                Source <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {s.stance_summary && (
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{s.stance_summary}</p>
            )}

            <div className="mt-2 text-sm">
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <Quote className="w-4 h-4" />
                <span>Quoted</span>
              </div>
              <blockquote className="border-l-2 border-gray-300 dark:border-gray-700 pl-3 text-gray-700 dark:text-gray-300 italic">
                {s.quote}
              </blockquote>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
