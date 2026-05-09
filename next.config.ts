import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' 'self'; connect-src * 'unsafe-inline' wss: ws: https:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;