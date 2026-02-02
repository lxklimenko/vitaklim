'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Heart, Check, Copy } from 'lucide-react'
import { Prompt } from '../types/prompt'

interface PromptCardProps {
  prompt: Prompt
  favorites: number[]
  toggleFavorite: (e: React.MouseEvent, id: number) => void
  handleCopy: (id: number, text: string, price: number) => void
  setSelectedPrompt: (p: Prompt) => void
  copiedId: number | null
}

export const PromptCard = React.memo(({
  prompt,
  favorites,
  toggleFavorite,
  handleCopy,
  setSelectedPrompt,
  copiedId
}: PromptCardProps) => {
  const isFavorite = favorites.includes(prompt.id)

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col group cursor-pointer"
      onClick={() => setSelectedPrompt(prompt)}
    >
      {/* Контейнер изображения */}
      <div className="relative aspect-[3/4] rounded-[1.25rem] overflow-hidden bg-[#111] mb-2">
        <img 
          src={prompt.image?.src} 
          alt={prompt.title}
          loading="lazy" 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* УДАЛЕН БЛОК С ЦЕНОЙ */}

        {/* Избранное справа сверху */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFavorite(e, prompt.id); }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/50 hover:text-white transition-colors"
        >
          <Heart size={14} fill={isFavorite ? "white" : "none"} className={isFavorite ? "text-white" : ""} />
        </button>
      </div>

      {/* Текстовый блок ПОД фото */}
      <div className="px-1 space-y-1">
        <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
          {prompt.tool}
        </p>
        <h3 className="text-[14px] font-medium text-white leading-snug mb-3">
          {prompt.title}
        </h3>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            handleCopy(prompt.id, prompt.prompt || "", prompt.price); 
          }}
          className={`w-full py-2 backdrop-blur-lg border rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
            copiedId === prompt.id 
              ? 'bg-white border-white text-black hover:bg-white/90' 
              : 'bg-white/[0.08] border-white/5 text-white/90 hover:bg-white/[0.12]'
          }`}
        >
          {copiedId === prompt.id ? <Check size={12} /> : <Copy size={12} />}
          <span className="text-[12px] font-medium">
            {copiedId === prompt.id ? "Скопировано" : prompt.price > 0 ? `Копия за ${prompt.price} ₽` : "Скопировать бесплатно"}
          </span>
        </button>
      </div>
    </motion.div>
  )
})

PromptCard.displayName = 'PromptCard'