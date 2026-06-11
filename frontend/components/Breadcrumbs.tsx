import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 md:mb-6">
      <ol className="flex items-center space-x-1 md:space-x-2 text-sm text-gray-600 dark:text-gray-400">
        {/* Home Link */}
        <li>
          <Link
            href="/"
            className="flex items-center hover:text-gray-900 dark:hover:text-gray-50 transition-colors"
            aria-label="Home"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>

        {/* Breadcrumb Items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={index} className="flex items-center space-x-1 md:space-x-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-gray-900 dark:hover:text-gray-50 transition-colors truncate max-w-[150px] md:max-w-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-gray-900 dark:text-gray-50 font-medium truncate max-w-[150px] md:max-w-none"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
