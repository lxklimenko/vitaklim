'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, Check, Copy, ImageOff } from 'lucide-react'
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
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const isFavorite = favorites.includes(prompt.id)

  // Создаем Intersection Observer для отслеживания видимости
  useEffect(() => {
    const card = document.querySelector(`[data-prompt-id="${prompt.id}"]`)
    if (!card) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect() // Отключаем после первого срабатывания
          }
        })
      },
      {
        rootMargin: '200px', // Начинаем загрузку заранее
        threshold: 0.1
      }
    )

    observer.observe(card)

    return () => {
      observer.disconnect()
    }
  }, [prompt.id])

  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col group cursor-pointer"
      onClick={() => setSelectedPrompt(prompt)}
      data-prompt-id={prompt.id}
    >
      {/* Контейнер изображения */}
      <div className="relative aspect-[3/4] rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-[#111] to-[#222] mb-2 group">
        {/* Лоадер/плейсхолдер */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#111] to-[#222] animate-pulse">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* Состояние ошибки */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#111] to-[#222] text-white/40 p-4">
            <ImageOff size={48} className="mb-2" />
            <p className="text-xs text-center">Не удалось загрузить изображение</p>
          </div>
        )}

        {/* Основное изображение */}
        {(isInView && !hasError) && (
          <img 
            src={prompt.image?.src} 
            alt={prompt.title}
            loading="lazy"
            decoding="async"
            className={`
              w-full h-full object-cover
              transition-all duration-300 ease-out
              group-hover:brightness-110
              group-hover:contrast-105
              active:brightness-95
              ${isLoading ? 'opacity-0' : 'opacity-100'}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          />
        )}
        
        {/* Overlay для затемнения при наведении */}
        <div
          className={`
            absolute inset-0
            transition-colors duration-300
            ${isLoading || hasError ? 'bg-black/40' : 'bg-black/0 group-hover:bg-black/10'}
          `}
        />
        
        {/* Избранное справа сверху */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFavorite(e, prompt.id); }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/50 hover:text-white transition-colors z-10"
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