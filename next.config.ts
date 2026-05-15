/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src *;"
          }
        ],
      },
    ];
  },
};

export default nextConfig;