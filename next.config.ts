/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  generateBuildId: async () => `build-${Date.now()}`,
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
};

export default nextConfig;