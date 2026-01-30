import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. Включаем статический экспорт */
  output: 'export',

  /* 2. Отключаем серверную оптимизацию изображений */
  images: {
    unoptimized: true,
  },

  /* 3. Опционально: добавляем слеш в конце URL (помогает с роутингом на Beget) */
  trailingSlash: true,

  /* 4. Позволяет игнорировать ошибки TypeScript при сборке (полезно для QA-тестов) */
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;