import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4">
            <FileQuestion className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-50">
          Page not found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-red-700 text-white font-medium hover:bg-red-800 transition-colors min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
          <Link
            href="/candidates"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Browse candidates
          </Link>
        </div>
      </div>
    </div>
  )
}
