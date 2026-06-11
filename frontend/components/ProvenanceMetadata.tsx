"use client"

import type { Vote } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"

interface ProvenanceMetadataProps {
  vote: Vote
}

export function ProvenanceMetadata({ vote }: ProvenanceMetadataProps) {
  const [showHash, setShowHash] = useState(false)

  // Calculate estimated cost (gpt-5-mini: ~$0.15 per 1M tokens)
  const estimatedCost = vote.ai_response_tokens
    ? (vote.ai_response_tokens * 0.00000015).toFixed(6)
    : null

  // Format timestamps
  const fetchedTime = vote.fetched_at
    ? formatDistanceToNow(new Date(vote.fetched_at), { addSuffix: true })
    : null

  const processedTime = vote.processed_at
    ? formatDistanceToNow(new Date(vote.processed_at), { addSuffix: true })
    : null

  return (
    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h4 className="text-xs font-semibold text-gray-900">Data Provenance</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {/* Fetched timestamp */}
        {fetchedTime && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">Fetched:</span>
            <span className="text-gray-900 font-medium">{fetchedTime}</span>
          </div>
        )}

        {/* Processed timestamp */}
        {processedTime && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">Processed:</span>
            <span className="text-gray-900 font-medium">{processedTime}</span>
          </div>
        )}

        {/* AI Model */}
        {vote.model_version && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">AI Model:</span>
            <span className="text-gray-900 font-mono text-xs">{vote.model_version}</span>
          </div>
        )}

        {/* Prompt Version */}
        {vote.prompt_version && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">Prompt:</span>
            <span className="text-gray-900 font-mono text-xs">{vote.prompt_version}</span>
          </div>
        )}

        {/* Token Usage */}
        {vote.ai_response_tokens && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">Tokens:</span>
            <span className="text-gray-900 font-medium">
              {vote.ai_response_tokens.toLocaleString()}
              {estimatedCost && (
                <span className="text-gray-500 ml-1">(~${estimatedCost})</span>
              )}
            </span>
          </div>
        )}

        {/* Confidence Level */}
        <div className="flex items-start gap-2">
          <span className="text-gray-600 shrink-0">Status:</span>
          <span className="text-gray-900 font-medium capitalize">
            {vote.confidence.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Source Hash (collapsible) */}
      {vote.source_hash && (
        <div className="pt-2 border-t border-red-300">
          <button
            onClick={() => setShowHash(!showHash)}
            className="flex items-center gap-1 text-xs text-red-700 hover:text-red-900 font-medium"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${showHash ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Integrity Hash (SHA-256)</span>
          </button>

          {showHash && (
            <div className="mt-2 flex items-center gap-2 bg-white rounded p-2 border border-red-200">
              <code className="text-xs font-mono text-gray-700 flex-1 break-all">
                {vote.source_hash}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(vote.source_hash!)
                }}
                className="text-red-600 hover:text-red-800 flex-shrink-0"
                title="Copy hash"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
