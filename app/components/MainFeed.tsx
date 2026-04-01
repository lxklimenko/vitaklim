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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-6 px-6 pt-2"
        >
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight mb-1">
            Создавай шедевры
          </h1>
          <p className="text-[13px] text-white/35 font-light">
            Промпты для генерации ИИ-изображений
          </p>
        </motion.div>
      )}

      {/* Категории */}
      <div className="relative mb-8">
        <nav className="flex gap-2 overflow-x-auto no-scrollbar px-6">
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              whileTap={{ scale: 0.96 }}
              className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-300 flex-shrink-0 ${
                activeCategory === cat
                  ? 'bg-white text-black'
                  : 'bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </nav>
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      {/* Сетка */}
      <section className="max-w-7xl mx-auto">
        {!isLoading && filteredPrompts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-white/20"
          >
            <SearchX size={40} className="mb-3" />
            <p className="text-sm font-light">Ничего не найдено</p>
          </motion.div>
        )}

        <div className="grid grid-cols-3 gap-[3px] px-0 md:grid-cols-4 md:gap-1 md:px-6">
          {isLoading && filteredPrompts.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredPrompts.slice(0, visibleCount).map((p, index) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                >
                  <PromptCard
                    prompt={p}
                    priority={index < 4}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    handleCopy={handleCopy}
                    copiedId={copiedId}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Кнопка */}
        {filteredPrompts.length > visibleCount && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 mb-2 flex justify-center px-6"
          >
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="w-full max-w-sm py-4 rounded-2xl bg-white/[0.06] text-white/60 text-[15px] font-medium active:scale-[0.98] transition-all hover:bg-white/10 hover:text-white border border-white/[0.06]"
            >
              Показать ещё
            </button>
          </motion.div>
        )}
      </section>
    </>
  );
});
