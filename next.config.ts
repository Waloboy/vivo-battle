import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' 'self'; connect-src * 'unsafe-inline' wss: ws: https:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';",
        },
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    }];
  },
  // Vital: transpile LiveKit packages so the bundler doesn't strip eval/wasm
  transpilePackages: ['livekit-client', '@livekit/components-react'],
};

export default nextConfig;