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
    ],
  },

  /* 3. Добавляем слеш в конце URL (помогает с роутингом на Beget) */
  trailingSlash: true,

  /* 4. Настройки TypeScript */
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;