'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SearchX, ChevronRight } from 'lucide-react';
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
          className="mb-8 px-4 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
            <span className="text-yellow-400 text-xs">🍌</span>
            <span className="text-white/60 text-xs font-medium">Генерация изображений с ИИ</span>
          </div>
          <h1 className="text-[36px] md:text-5xl font-bold tracking-tighter mb-3 text-white leading-tight">
            Создавай<br />
            <span className="text-yellow-400">шедевры</span>
          </h1>
          <p className="text-[13px] md:text-base text-white/40 max-w-xs mx-auto leading-relaxed">
            Готовые промпты для генерации идеальных изображений
          </p>
        </motion.div>
      )}

      {/* Категории */}
      <div className="relative mb-6">
        <nav className="max-w-7xl mx-auto flex justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar px-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold tracking-tight border transition-all duration-300 flex-shrink-0 ${
                activeCategory === cat
                  ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                  : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>
        {/* Градиент справа показывает что есть ещё категории */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden" />
      </div>

      {/* Сетка промптов */}
      <section className="max-w-7xl mx-auto">
        {!isLoading && filteredPrompts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <SearchX size={48} className="mb-4" />
            <p className="text-sm">По вашему запросу ничего не найдено</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 px-2 md:grid-cols-4 md:gap-4 md:px-6">
          {isLoading && filteredPrompts.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
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

        {/* Кнопка "Загрузить ещё" */}
        {filteredPrompts.length > visibleCount && !isLoading && (
          <div className="mt-8 mb-4 flex justify-center px-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-medium active:scale-95 transition-all hover:bg-white/10 hover:text-white hover:border-white/20"
            >
              Показать ещё
              <ChevronRight size={16} className="text-yellow-400" />
            </button>
          </div>
        )}
      </section>
    </>
  );
});
