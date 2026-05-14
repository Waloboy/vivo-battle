/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' * data: blob: 'unsafe-inline' 'unsafe-eval'",
              "script-src 'self' * 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vivo-battle-wy48g9g4.livekit.cloud https://zyrmgjkvojqfmhqammkl.supabase.co",
              "connect-src 'self' * wss: ws: https: http: wss://vivo-battle-wy48g9g4.livekit.cloud wss://zyrmgjkvojqfmhqammkl.supabase.co",
              "img-src 'self' * data: blob:",
              "media-src 'self' * data: blob: mediastream:",
              "worker-src 'self' blob:",
              "frame-src 'self' *",
              "style-src 'self' 'unsafe-inline' *",
            ].join("; "),
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  // Transpilar paquetes de LiveKit para asegurar que eval/wasm funcionen correctamente
  transpilePackages: ['livekit-client', '@livekit/components-react'],
  turbopack: {},
};

export default nextConfig;