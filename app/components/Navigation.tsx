'use client';

import React from 'react';
import { Home as HomeIcon, Star, Plus, Clock, User as UserIcon } from 'lucide-react';
import { NavItem } from './UIElements';

interface NavigationProps {
  isFavoritesView: boolean;
  setIsFavoritesView: (value: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (value: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (value: boolean) => void;
  onOpenGenerator: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  isFavoritesView,
  setIsFavoritesView,
  isProfileOpen,
  setIsProfileOpen,
  isHistoryOpen,
  setIsHistoryOpen,
  onOpenGenerator,
}) => {
  const resetOtherViews = () => {
    setIsFavoritesView(false);
    setIsProfileOpen(false);
    setIsHistoryOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[110] md:hidden pb-safe glass border-t border-white/[0.03]">
      <div className="relative h-14 px-6 flex items-center justify-between">
        <NavItem 
          icon={<HomeIcon size={18} />} 
          label="Дом" 
          active={!isFavoritesView && !isProfileOpen && !isHistoryOpen} 
          onClick={() => {
            resetOtherViews();
          }} 
        />
        
        <NavItem 
          icon={<Star size={18} />} 
          label="Избранное" 
          active={isFavoritesView} 
          onClick={() => {
            setIsFavoritesView(true);
            setIsProfileOpen(false);
            setIsHistoryOpen(false);
          }} 
        />
        
        <div className="relative -mt-8 flex justify-center">
          <button 
            onClick={onOpenGenerator}
            aria-label="Открыть окно генерации"
            className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_8px_30px_rgb(255,255,255,0.2)] active:scale-90 transition-all border-[6px] border-black"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>
        
        <NavItem 
          icon={<Clock size={18} />} 
          label="История" 
          active={isHistoryOpen} 
          onClick={() => {
            setIsHistoryOpen(true);
            setIsFavoritesView(false);
            setIsProfileOpen(false);
          }} 
        />
        
        <NavItem 
          icon={<UserIcon size={18} />} 
          label="Профиль" 
          active={isProfileOpen} 
          onClick={() => {
            setIsProfileOpen(true);
            setIsFavoritesView(false);
            setIsHistoryOpen(false);
          }} 
        />
      </div>
    </nav>
  );
};