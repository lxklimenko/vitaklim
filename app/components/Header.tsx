'use client';

import React from 'react';
import { Sparkles, Search } from 'lucide-react';

interface HeaderProps {
  user: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (isActive: boolean) => void;
  onOpenProfile: () => void;
  onResetView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  searchQuery,
  setSearchQuery,
  isSearchActive,
  setIsSearchActive,
  onOpenProfile,
  onResetView,
}) => {
  return (
    <header className="sticky top-0 z-[100] glass border-b border-white/[0.05] pt-safe">
      <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between gap-4">
        <div 
          className={`flex items-center gap-2 cursor-pointer transition-all duration-500 active:scale-95 ${
            isSearchActive ? 'opacity-0 w-0 md:opacity-100 md:w-auto overflow-hidden' : 'opacity-100'
          }`} 
          onClick={onResetView}
        >
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-black" />
          </div>
          <span className="text-base font-semibold tracking-tight hidden sm:inline">Vision</span>
        </div>

        <div className={`flex-grow flex items-center gap-2 bg-[#1c1c1e] rounded-full px-4 py-2.5 transition-all duration-500 border ${
          isSearchActive ? 'border-white/10 ring-4 ring-white/5' : 'border-transparent'
        }`}>
          <button aria-label="Поиск" className="p-1">
            <Search size={16} className="text-white/30" />
          </button>
          <input 
            type="text" 
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchActive(true)}
            onBlur={() => !searchQuery && setIsSearchActive(false)}
            className="bg-transparent border-none outline-none text-[14px] w-full text-white placeholder:text-white/30 font-medium"
          />
        </div>

        <button 
          onClick={onOpenProfile} 
          className="text-[12px] font-semibold text-white/70 hover:text-white transition-colors duration-500 select-none flex-shrink-0 px-2 tracking-tight"
        >
          {user ? user.email?.split('@')[0] : "Войти"}
        </button>
      </div>
    </header>
  );
};