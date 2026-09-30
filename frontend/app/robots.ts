import { MetadataRoute } from 'next'

// Archived snapshot: not maintained, so it stays out of every index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  }
}
