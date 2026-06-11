import { MetadataRoute } from 'next'
import { getCandidates, getMotions, getMotionTopicStats } from '@/lib/localData'
import { absoluteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: absoluteUrl('/candidates'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/motions'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/compare'),
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
      url: absoluteUrl(`/candidates/${candidate.slug}`),
      lastModified: new Date(candidate.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const motionRoutes: MetadataRoute.Sitemap = motions.map((motion) => ({
      url: absoluteUrl(`/motions/${motion.id}`),
      lastModified: new Date(motion.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    const topicRoutes: MetadataRoute.Sitemap = topicStats.map((stat) => ({
      url: absoluteUrl(`/topics/${encodeURIComponent(stat.topic)}`),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticRoutes, ...candidateRoutes, ...motionRoutes, ...topicRoutes]
  } catch (err) {
    // Keep the local archive buildable even if the seed database cannot be opened.
    return staticRoutes
  }
}
