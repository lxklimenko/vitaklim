import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import ClientProviders from './ClientProviders'

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
      <body className="font-sans bg-[#0a0a0a] text-white antialiased selection:bg-white/20">
        
        <Script 
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        <ClientProviders>
          <div className="relative min-h-screen flex flex-col overflow-x-hidden">
            <div className="flex-1 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </div>
        </ClientProviders>

      </body>
    </html>
  );
}