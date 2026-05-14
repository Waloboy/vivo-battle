import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
            "script-src * 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vivo-battle-wy48g9g4.livekit.cloud https://zyrmgjkvojqfmhqammkl.supabase.co",
            "connect-src * wss: ws: https: http: wss://vivo-battle-wy48g9g4.livekit.cloud wss://zyrmgjkvojqfmhqammkl.supabase.co",
            "img-src * data: blob:",
            "media-src * data: blob: mediastream:",
            "worker-src * blob:",
            "frame-src *",
            "style-src * 'unsafe-inline'",
          ].join("; ") + ";",
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
  turbopack: {},
  webpack: (webpackConfig: any) => {
    webpackConfig.optimization.minimize = false;
    return webpackConfig;
  },
};

export default nextConfig;