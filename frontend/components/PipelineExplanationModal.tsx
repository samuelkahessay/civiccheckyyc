"use client"

import { useState } from "react"

export function PipelineExplanationModal() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-red-700 hover:text-red-800 font-medium mt-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>What is this?</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">How CivicCheckYYC Works</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Section 1: How We Source Data */}
              <section>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">How We Source Data</h3>
                    <p className="text-sm text-gray-700 mb-3">
                      All voting records come from the{' '}
                      <a
                        href="https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        City of Calgary Open Data Portal
                      </a>
                      , the official government database of council and committee votes.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                      <li>We fetch votes via Calgary's Socrata API</li>
                      <li>Each vote has a unique row ID and direct JSON API link</li>
                      <li>Meeting documents link to Calgary's official calendar and eScribe</li>
                      <li>All source data is timestamped and archived</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 2: How We Process Data */}
              <section>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">How We Process Data</h3>
                    <p className="text-sm text-gray-700 mb-3">
                      Motion titles and summaries are AI-generated for readability. The original resolution text is always available.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                      <li>The archived summaries were produced with versioned prompts</li>
                      <li>All processing is logged: timestamps, model version, prompt version, token usage</li>
                      <li>The AI summarizes complex legal language into plain English</li>
                      <li>Votes marked "AI Generated" have not been human-verified</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 3: Data Integrity */}
              <section>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Integrity</h3>
                    <p className="text-sm text-gray-700 mb-3">
                      We maintain full audit trails to ensure data hasn't been tampered with.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                      <li>SHA-256 hashes verify vote records haven't been altered</li>
                      <li>Timestamped immutable archives preserve historical data</li>
                      <li>Direct links to source data allow independent verification</li>
                      <li>All code is open-source (coming soon)</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 4: Non-Partisan Approach */}
              <section>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Non-Partisan Approach</h3>
                    <p className="text-sm text-gray-700 mb-3">
                      CivicCheckYYC is an independent transparency tool. We don't endorse or oppose any candidate.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                      <li>We display voting records without commentary or interpretation</li>
                      <li>All candidates are treated equally</li>
                      <li>Users can verify all information via source links</li>
                      <li>Not affiliated with any political party or campaign</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Footer */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600">
                  <strong>Have questions?</strong> CivicCheckYYC is built to help Calgary voters make informed decisions.
                  All data is sourced from official government databases and processed with full transparency.
                </p>
              </div>
            </div>

            {/* Footer Button */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-red-700 text-white rounded-lg px-4 py-2 font-medium hover:bg-red-800 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
