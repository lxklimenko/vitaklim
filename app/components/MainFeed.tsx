'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SearchX } from 'lucide-react';
import { PromptCard } from './PromptCard';
import { SkeletonCard } from './UIElements';
import { CATEGORIES } from '../constants/appConstants';
import type { Prompt } from '../types/prompt';

interface MainFeedProps {
  isLoading: boolean;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  filteredPrompts: Prompt[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  favorites: number[];
  toggleFavorite: (e: React.MouseEvent, id: number) => void;
  handleCopy: (id: number, text: string, price: number) => void;
  copiedId: number | null;
  searchQuery: string;
}

export const MainFeed = React.memo(function MainFeed({
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
  searchQuery,
}: MainFeedProps) {
  return (
    <>
      {/* Заголовок */}
      {!searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4 text-center"
        >
          <h1 className="text-[32px] md:text-5xl font-bold tracking-tighter mb-1 text-white">
            Создавай шедевры
          </h1>
          <p className="text-[13px] md:text-base text-white/40 max-w-xl mx-auto leading-relaxed">
            Маркетплейс премиальных промптов.
          </p>
        </motion.div>
      )}

      {/* Категории */}
      <nav className="max-w-7xl mx-auto mb-6 flex justify-start md:justify-center gap-1.5 overflow-x-auto no-scrollbar px-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-[13px] font-semibold tracking-tight border transition-all duration-300 flex-shrink-0 ${
              activeCategory === cat
                ? 'bg-white text-black border-white shadow-lg'
                : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Сетка промптов */}
      <section className="max-w-7xl mx-auto min-h-[400px]">
        {!isLoading && filteredPrompts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <SearchX size={48} className="mb-4" />
            <p className="text-sm">По вашему запросу ничего не найдено</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 px-2 md:grid-cols-4 md:gap-4 md:px-6">
          {isLoading && filteredPrompts.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredPrompts.slice(0, visibleCount).map((p, index) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  priority={index < 4}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  handleCopy={handleCopy}
                  copiedId={copiedId}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Кнопка "Показать ещё" */}
        {filteredPrompts.length > visibleCount && !isLoading && (
          <div className="mt-12 flex justify-center px-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 8)}
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-medium active:scale-95 transition-all hover:bg-white/10 hover:text-white"
            >
              Загрузить ещё
            </button>
          </div>
        )}
      </section>
    </>
  );
});
