const DEFAULT_SITE_URL = 'http://localhost:3000'

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
}

export function absoluteUrl(path = '') {
  if (!path) return getSiteUrl()
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
