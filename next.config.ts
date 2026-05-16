/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
  webpack: (config: any, { dev, isServer }: any) => {
    if (dev && !isServer) {
      config.webSocketServer = false; // Desactiva el server de WS del HMR ruidoso
    }
    return config;
  },
};

export default nextConfig;