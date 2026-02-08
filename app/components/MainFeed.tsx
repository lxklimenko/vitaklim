'use client';

import React from 'react';
import { PromptCard } from './PromptCard';
import { SkeletonCard } from './UIElements';
// Исправлен импорт на относительный путь
import { CATEGORIES } from '../constants/appConstants';

interface MainFeedProps {
  isLoading: boolean;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  filteredPrompts: any[];
  visibleCount: number;
  setVisibleCount: (count: number | ((prev: number) => number)) => void;
  favorites: number[];
  toggleFavorite: (e: React.MouseEvent, id: number) => void;
  handleCopy: (id: number, text: string, price: number) => void;
  copiedId: number | null;
  isSearchActive: boolean; // Чтобы скрывать заголовок при поиске
  searchQuery: string;
}

export const MainFeed: React.FC<MainFeedProps> = ({
  isLoading,
  activeCategory,
  setActiveCategory,
  filteredPrompts,
  visibleCount,
  setVisibleCount,
  favorites,
  toggleFavorite,
  handleCopy,
  copiedId,
  isSearchActive,
  searchQuery
}) => {
  
  return (
    <>
      {/* Заголовок (скрываем при поиске) */}
      {!searchQuery && (
        <div className="mb-6 px-4 text-center">
          <h1 className="text-[32px] md:text-5xl font-bold tracking-tighter mb-1 text-white">
            Создавай шедевры
          </h1>
          <p className="text-[13px] md:text-base text-white/40 max-w-xl mx-auto leading-relaxed">
            Маркетплейс премиальных промптов.
          </p>
        </div>
      )}

      {/* Категории */}
      <section className="max-w-7xl mx-auto mb-6 flex justify-start md:justify-center gap-1.5 overflow-x-auto no-scrollbar px-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-[13px] font-semibold tracking-tight border transition-all duration-500 ease-out flex-shrink-0 ${
              activeCategory === cat
                ? 'bg-white text-black border-white shadow-md shadow-black/20' 
                : 'bg-transparent text-white/40 border-transparent hover:text-white/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </section>

      {/* Сетка промптов */}
      <section className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 gap-4 px-4">
          {isLoading && filteredPrompts.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
          ) : (
            filteredPrompts.slice(0, visibleCount).map((p, index) => (
              <PromptCard 
                key={p.id}
                prompt={p}
                priority={index === 0}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                handleCopy={handleCopy}
                copiedId={copiedId}
              />
            ))
          )}
        </div>
        
        {/* Кнопка "Показать больше" */}
        {filteredPrompts.length > visibleCount && !isLoading && (
          <div className="mt-8 flex justify-center px-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-medium active:scale-[0.98] transition-all hover:text-white/80"
            >
              Показать больше
            </button>
          </div>
        )}
      </section>
    </>
  );
};