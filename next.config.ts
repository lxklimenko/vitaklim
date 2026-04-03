import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. Временно отключаем статический экспорт для разработки */
  // output: 'export',

  /* 2. Настройки изображений */
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gmngqxwkgnuqtkwndjwx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'gmngqxwkgnuqtkwndjwx.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'https',
        hostname: 'gmngqxwkgnuqtkwndjwx.supabase.co',
        port: '',
        pathname: '/storage/v1/render/**',
      },
    ],
  },

  /* 3. Настройки TypeScript */
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;