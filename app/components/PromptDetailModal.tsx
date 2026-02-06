'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Copy, Check, Upload } from 'lucide-react';
import { Generation } from '../types';

interface PromptDetailModalProps {
  selectedPrompt: any;
  onClose: () => void;
  favorites: number[];
  toggleFavorite: (e: React.MouseEvent, id: number) => void;
  toggleGenerationFavorite: (generation: Generation) => void;
  generations: Generation[];
  handleCopy: (id: number, text: string, price: number) => void;
  handleDownload: (url: string, filename?: string) => void;
  copiedId: number | null;
  setIsGenerateOpen: (v: boolean) => void;
  setGeneratePrompt: (v: string) => void;
}

export function PromptDetailModal({
  selectedPrompt,
  onClose,
  favorites,
  toggleFavorite,
  toggleGenerationFavorite,
  generations,
  handleCopy,
  handleDownload,
  copiedId,
  setIsGenerateOpen,
  setGeneratePrompt
}: PromptDetailModalProps) {
  if (!selectedPrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-x-hidden overscroll-none">
        <motion.div 
          className="absolute inset-0 bg-black/90 backdrop-blur-md touch-none"
          onClick={onClose} 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
        />
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          transition={{ duration: 0.25 }} 
          className="relative bg-[#111] w-full max-w-3xl rounded-[2.5rem] overflow-hidden z-10 shadow-2xl"
        >
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-black/40 text-white/50 z-20"><X size={20} /></button>
          
          <div className="flex flex-col md:flex-row max-h-[85vh] overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable] no-scrollbar min-w-0">
            {/* Изображение */}
            <div className="relative w-full h-[70vh] flex items-start justify-center">
              <img
                src={selectedPrompt.image?.src}
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40"
                alt="blur-bg"
              />
              <img
                src={selectedPrompt.image?.src}
                className="relative z-10 max-h-full w-auto object-contain"
                alt="prompt-img"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>
            
            {/* Правая часть с текстом */}
            <div className="md:w-1/2 relative flex flex-col justify-end">
              <div className="absolute -inset-x-6 -bottom-6 h-[50vh] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-0" />

              <div className="relative z-10 p-5 md:p-10 space-y-3">
                <div className="flex gap-3 h-32">
                  <div className="flex-1 bg-white/4 border border-white/8 rounded-xl px-4 py-3 overflow-y-auto">
                    <p className="text-[13px] leading-relaxed text-white/80 whitespace-pre-wrap select-all min-w-0 break-words">
                      {selectedPrompt.prompt}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 bg-white/4 border border-white/8 rounded-xl p-2 w-14 items-center">
                    <button
                      onClick={(e) => {
                        if (selectedPrompt?.isHistory) {
                          const gen = generations.find((g: any) => g.id === selectedPrompt.id);
                          if (gen) toggleGenerationFavorite(gen);
                        } else {
                          toggleFavorite(e, selectedPrompt.id as number);
                        }
                      }}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition"
                      title="Добавить в избранное"
                    >
                      <Heart 
                        size={18} 
                        strokeWidth={1.5}
                        className={`transition-colors duration-300 ${
                          selectedPrompt.isHistory
                            ? (generations.find((g: any) => g.id === selectedPrompt.id)?.is_favorite ? "text-red-500 fill-red-500" : "text-white/70")
                            : (favorites.includes(selectedPrompt.id as number) ? "text-red-500 fill-red-500" : "text-white/70")
                        }`} 
                      />
                    </button>

                    <button
                      onClick={() => handleCopy(selectedPrompt.id as number, selectedPrompt.prompt, selectedPrompt.price)}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition"
                      title="Копировать промпт"
                    >
                      {copiedId === selectedPrompt.id ? <Check size={18} strokeWidth={1.5} /> : <Copy size={18} strokeWidth={1.5} />}
                    </button>

                    <button
                      onClick={() => handleDownload(selectedPrompt.image?.src || "", 'vision-prompt.jpg')}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition"
                      title="Скачать изображение"
                    >
                      <Upload size={18} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsGenerateOpen(true);
                    setGeneratePrompt(selectedPrompt.prompt);
                    onClose();
                  }}
                  className="w-full py-4 rounded-2xl text-[15px] font-semibold bg-white text-black shadow-[0_-12px_40px_rgba(0,0,0,0.55)] active:scale-[0.98] transition"
                >
                  Сгенерировать
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}