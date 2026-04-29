'use client';

import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/60 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[13px] text-white/50">
          {/* Левая часть — копирайт и реквизиты */}
          <div className="space-y-1">
            <div className="text-white/70 font-semibold">KLEX.PRO</div>
            <div>© {year} ИП Клименко А.А.</div>
            <div className="text-white/40">ИНН 234607306390 · ОГРНИП 323237500027371</div>
          </div>

          {/* Правая часть — ссылки */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/pricing"
              className="hover:text-white transition-colors"
            >
              Тарифы
            </Link>
            <Link
              href="/terms"
              className="hover:text-white transition-colors"
            >
              Публичная оферта
            </Link>
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              Политика конфиденциальности
            </Link>
            <a
              href="mailto:lxklimenko@gmail.com"
              className="hover:text-white transition-colors"
            >
              lxklimenko@gmail.com
            </a>
          </nav>
        </div>
      </div>

      {/* Дополнительный отступ снизу для мобильной нижней навигации */}
      <div className="md:hidden h-20" aria-hidden="true" />
    </footer>
  );
}
