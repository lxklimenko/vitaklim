'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Tv, Plus, Clock, User } from 'lucide-react';

export const Navigation: React.FC = () => {
  const pathname = usePathname();

  const isHomePage = pathname === '/';
  const isFeedPage = pathname === '/feed';
  const isHistoryPage = pathname === '/history';
  const isProfilePage = pathname === '/profile';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[420px] md:rounded-3xl md:overflow-hidden md:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-t border-white/10 md:border md:border-white/10 md:rounded-3xl"></div>

      <div className="relative h-20 px-6 flex items-center justify-between">

        {/* 1. ГЛАВНАЯ */}
        <Link href="/" className="min-w-12.5 flex justify-center">
          <NavItem icon={<Home size={22} />} label="Главная" active={isHomePage} />
        </Link>

        {/* 2. ЛЕНТА */}
        <Link href="/feed" className="min-w-12.5 flex justify-center">
          <NavItem icon={<Tv size={22} />} label="Лента" active={isFeedPage} />
        </Link>

        {/* 3. ГЕНЕРАТОР */}
        <div className="relative -mt-8">
          <Link
            href="/generate"
            className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
          >
            <Plus size={28} />
          </Link>
        </div>

        {/* 4. ИСТОРИЯ */}
        <Link href="/history" className="min-w-12.5 flex justify-center">
          <NavItem icon={<Clock size={22} />} label="История" active={isHistoryPage} />
        </Link>

        {/* 5. ПРОФИЛЬ */}
        <Link href="/profile" className="min-w-12.5 flex justify-center">
          <NavItem icon={<User size={22} />} label="Профиль" active={isProfilePage} />
        </Link>

      </div>
    </nav>
  );
};

function NavItem({ icon, label, active = false }: any) {
  return (
    <div className="flex flex-col items-center gap-1 text-xs cursor-pointer group">
      <div className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {icon}
      </div>
      <span className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {label}
      </span>
    </div>
  );
}
