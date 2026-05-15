/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
};

export default nextConfig;