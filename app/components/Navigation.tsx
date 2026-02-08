'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Star, Plus, Clock, User } from 'lucide-react';

interface NavigationProps {
  isFavoritesView?: boolean;
  setIsFavoritesView?: (value: boolean) => void;
  // Убираем isHistoryOpen и setIsHistoryOpen - они больше не нужны тут
  onOpenGenerator: () => void;
  onOpenProfile: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  isFavoritesView,
  setIsFavoritesView,
  onOpenGenerator,
  onOpenProfile,
}) => {
  const pathname = usePathname();
  
  // Определяем активную страницу по URL
  const isHomePage = pathname === '/';
  const isHistoryPage = pathname === '/history';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      {/* Фон меню */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-t border-white/10"></div>

      <div className="relative h-20 px-6 flex items-center justify-between">
        
        {/* 1. ГЛАВНАЯ (Всегда ведет на /) */}
        <Link href="/" className="min-w-[50px] flex justify-center">
          <NavItem 
            icon={<Home size={22} />} 
            label="Главная" 
            active={isHomePage && !isFavoritesView} 
            onClick={() => setIsFavoritesView && setIsFavoritesView(false)}
          />
        </Link>

        {/* 2. ИЗБРАННОЕ (Работает только на главной) */}
        {isHomePage ? (
          <button 
            onClick={() => setIsFavoritesView && setIsFavoritesView(!isFavoritesView)}
            className="min-w-[50px] flex justify-center"
          >
            <NavItem icon={<Star size={22} />} label="Избранное" active={isFavoritesView} />
          </button>
        ) : (
          <Link href="/?view=favorites" className="min-w-[50px] flex justify-center opacity-50">
             <NavItem icon={<Star size={22} />} label="Избранное" active={false} />
          </Link>
        )}

        {/* 3. КНОПКА ПЛЮС */}
        <div className="relative -mt-8">
          <button 
            onClick={onOpenGenerator}
            className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
          >
            <Plus size={28} />
          </button>
        </div>

        {/* 4. ИСТОРИЯ (ЭТО ВАЖНО: Теперь это Link на /history) */}
        <Link href="/history" className="min-w-[50px] flex justify-center">
           <NavItem icon={<Clock size={22} />} label="История" active={isHistoryPage} />
        </Link>

        {/* 5. ПРОФИЛЬ */}
        <button onClick={onOpenProfile} className="min-w-[50px] flex justify-center">
           <NavItem icon={<User size={22} />} label="Профиль" active={false} />
        </button>

      </div>
    </nav>
  );
};

// Вспомогательный компонент
function NavItem({ icon, label, active = false, onClick }: any) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-1 text-xs cursor-pointer group">
      <div className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {icon}
      </div>
      <span className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {label}
      </span>
    </div>
  );
}