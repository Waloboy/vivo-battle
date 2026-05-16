/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fuerza a que todos los scripts e iconos se busquen desde la raíz absoluta del dominio
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://arena58-clean.vercel.app' : undefined,
  trailingSlash: false,
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