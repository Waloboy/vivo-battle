/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  async headers() {
    return [
      // ── Public static assets: NO CSP, NO auth headers ──
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/sw-auth.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // ── Application pages: permissive CSP for Supabase Realtime + LiveKit ──
      {
        source: '/:path((?!manifest\\.json|assets|sw-auth\\.js|favicon\\.ico|_next).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://vivo-battle-wy48g9g4.livekit.cloud https://zyrmgjkvojqfmhqammkl.supabase.co",
              "connect-src 'self' https: wss: ws: http: data: blob: https://zyrmgjkvojqfmhqammkl.supabase.co wss://zyrmgjkvojqfmhqammkl.supabase.co https://vivo-battle-wy48g9g4.livekit.cloud wss://vivo-battle-wy48g9g4.livekit.cloud",
              "img-src 'self' data: blob: https: http:",
              "media-src 'self' data: blob: mediastream: https: http:",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-src 'self' https:",
              "style-src 'self' 'unsafe-inline' https: http:",
              "font-src 'self' data: https: http:",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
};

export default nextConfig;