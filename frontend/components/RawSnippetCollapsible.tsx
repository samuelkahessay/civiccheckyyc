"use client"

import { useState } from "react"

interface RawSnippetCollapsibleProps {
  sourceText: string | null
}

export function RawSnippetCollapsible({ sourceText }: RawSnippetCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!sourceText) {
    return null
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Raw Resolution Text</span>
        <span className="text-xs text-gray-500">({sourceText.length} characters)</span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 mt-2' : 'max-h-0'
        }`}
      >
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="max-h-64 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {sourceText}
            </pre>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-300 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              This is the original resolution text from Calgary Open Data
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(sourceText)
              }}
              className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
