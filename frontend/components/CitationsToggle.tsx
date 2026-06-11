"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface CitationItem {
  vote_id?: string
  source_api_url?: string
  source_row_id?: string
  report_numbers?: string[]
  [key: string]: any
}

export default function CitationsToggle({ citations, className }: { citations: CitationItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const count = Array.isArray(citations) ? citations.length : 0
  if (!count) return null

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 text-xs text-red-700 dark:text-red-300 hover:underline"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? `Hide citations (${count})` : `Show citations (${count})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-1">
          {citations.slice(0, 20).map((c, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
              <span className="shrink-0 text-gray-400">•</span>
              <div>
                {c.source_api_url ? (
                  <a
                    href={c.source_api_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Source JSON <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span>Vote: {c.vote_id || 'unknown'}</span>
                )}
                {Array.isArray(c.report_numbers) && c.report_numbers.length > 0 && (
                  <div className="text-[10px] text-gray-500">Reports: {c.report_numbers.join(', ')}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

