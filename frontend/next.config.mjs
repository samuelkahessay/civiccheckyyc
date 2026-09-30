// This archived snapshot is shown inside the archive frame on skahessay.dev.
// Only that origin may embed it; localhost is allowed in dev to test the frame.
const frameAncestors =
  process.env.NODE_ENV === 'production'
    ? "frame-ancestors 'self' https://skahessay.dev"
    : "frame-ancestors 'self' https://skahessay.dev http://localhost:*";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SQLite seed is read with fs at runtime, so tracing cannot see it.
  outputFileTracingIncludes: {
    '/**': ['./data/local-seed.sql'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: frameAncestors },
          // Archived snapshot: keep out of search indexes
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ];
  },
};

export default nextConfig;
