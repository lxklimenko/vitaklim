import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css"; // КРИТИЧНО: Этот импорт подключает Tailwind
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import { AuthProvider } from '@/app/context/AuthContext';

export const metadata: Metadata = {
  title: "PromptVision | Маркетплейс премиальных промптов",
  description: "Создавай шедевры с помощью ИИ. Лучшие промпты для Midjourney, Stable Diffusion и Flux.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body 
        className="font-sans bg-[#0a0a0a] text-white antialiased selection:bg-white/20"
      >
        {/* Скрипт Telegram Web App будет автоматически добавлен в head */}
        <Script 
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* Обертка для контента, чтобы избежать скачков при загрузке */}
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col overflow-x-hidden">
            {/* Добавлен div с отступом снизу для safe area */}
            <div className="flex-1 pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}