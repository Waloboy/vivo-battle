import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eliminamos devIndicators para evitar el error de TypeScript
  // y dejamos solo lo que la terminal te pidió obligatoriamente
  allowedDevOrigins: ['192.168.10.123', 'localhost:3000']
};

export default nextConfig;