import { MetadataRoute } from 'next'
import { getCandidates, getMotions, getMotionTopicStats } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://civiccheckyyc.vercel.app'

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/candidates`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/motions`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // Dynamic routes - be resilient if network/data is unavailable during build
  try {
    const [candidates, motions, topicStats] = await Promise.all([
      getCandidates(),
      getMotions(500), // Limit to most recent 500 motions
      getMotionTopicStats(),
    ])

    const candidateRoutes: MetadataRoute.Sitemap = candidates.map((candidate) => ({
      url: `${baseUrl}/candidates/${candidate.slug}`,
      lastModified: new Date(candidate.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const motionRoutes: MetadataRoute.Sitemap = motions.map((motion) => ({
      url: `${baseUrl}/motions/${motion.id}`,
      lastModified: new Date(motion.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    const topicRoutes: MetadataRoute.Sitemap = topicStats.map((stat) => ({
      url: `${baseUrl}/topics/${encodeURIComponent(stat.topic)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticRoutes, ...candidateRoutes, ...motionRoutes, ...topicRoutes]
  } catch (err) {
    // Fallback to static routes only if data fetch fails (e.g., no network at build time)
    return staticRoutes
  }
}
