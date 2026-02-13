import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // КРИТИЧНО: Этот импорт подключает Tailwind
import { AuthProvider } from '@/app/context/AuthContext';

const inter = Inter({ subsets: ["latin", "cyrillic"] });

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
        className={`${inter.className} bg-[#0a0a0a] text-white antialiased selection:bg-white/20`}
      >
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        {/* Обертка для контента, чтобы избежать скачков при загрузке */}
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col overflow-x-hidden">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}