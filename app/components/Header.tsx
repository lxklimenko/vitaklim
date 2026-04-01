'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface HeaderProps {
  user: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (isActive: boolean) => void;
  onOpenProfile: () => void;
  onResetView: () => void;
  authReady: boolean;
  profileReady: boolean;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  telegramUsername,
  telegramFirstName,
  searchQuery,
  setSearchQuery,
  isSearchActive,
  setIsSearchActive,
  onOpenProfile,
  onResetView,
  authReady,
}) => {
  const displayName = !authReady
    ? ""
    : user
      ? user.email?.includes('@telegram.local')
        ? telegramFirstName || (telegramUsername ? `@${telegramUsername}` : "")
        : user.email?.split('@')[0]
      : "Войти";

  return (
    <header className="relative z-10 border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* Логотип */}
        <div
          onClick={onResetView}
          className={`shrink-0 cursor-pointer active:scale-95 transition-all duration-300 ${
            isSearchActive ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
          }`}
        >
          <span className="text-[17px] font-bold tracking-tight text-white">KLEX</span>
        </div>

        {/* Поиск */}
        <div className={`grow flex items-center gap-2 bg-white/[0.07] rounded-full px-4 py-2 transition-all duration-300 ${
          isSearchActive ? 'ring-1 ring-white/20' : ''
        }`}>
          <Search size={14} className="text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="Поиск промптов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchActive(true)}
            onBlur={() => !searchQuery && setIsSearchActive(false)}
            className="bg-transparent border-none outline-none text-[13px] w-full text-white placeholder:text-white/30"
          />
        </div>

        {/* Профиль */}
        <button
          onClick={onOpenProfile}
          className="shrink-0 text-[13px] font-medium text-white/60 hover:text-white transition-colors"
        >
          {displayName || "Войти"}
        </button>
      </div>
    </header>
  );
};
