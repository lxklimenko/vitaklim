'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ImageOff } from 'lucide-react'
import { Prompt } from '../types/prompt'
import Image from 'next/image'
import Link from 'next/link'

interface PromptCardProps {
  prompt: Prompt
  favorites: number[]
  toggleFavorite: (e: React.MouseEvent, id: number) => void
  handleCopy: (id: number, text: string, price: number) => void
  copiedId: number | null
  priority?: boolean
}

export const PromptCard = React.memo(({
  prompt,
  favorites,
  toggleFavorite,
  priority = false
}: PromptCardProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const isFavorite = favorites.includes(prompt.id)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col group cursor-pointer"
    >
      <Link 
        href={`/prompt/${prompt.id}`}
        className="relative aspect-[3/4] rounded-[1.25rem] overflow-hidden bg-[#111] group block"
        onClick={(e) => {
          // Предотвращаем переход при клике на лайк
          if ((e.target as HTMLElement).closest('button')) {
            e.preventDefault()
          }
        }}
      >
        {/* Плейсхолдер во время загрузки */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse z-10">
             <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* Состояние ошибки */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] text-white/20 p-4 z-20">
            <ImageOff size={32} strokeWidth={1.5} />
          </div>
        )}

        {/* Изображение - Next.js сам сделает Lazy Load */}
        {!hasError && (
          <Image 
            src={prompt.image?.src || "/placeholder.jpg"} 
            alt={prompt.title}
            quality={75}
            priority={priority} // Важно для первых 2-4 карточек
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={`
              object-cover transition-transform duration-500 ease-out
              group-hover:scale-110
              ${isLoading ? 'opacity-0' : 'opacity-100'}
            `}
            onLoadingComplete={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        )}
        
        {/* Затемнение при наведении */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        
        {/* Кнопка Лайка */}
        <button 
          onClick={(e) => { 
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(e, prompt.id)
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-md text-white/50 hover:text-white transition-all active:scale-90 z-30"
        >
          <Heart 
            size={16} 
            fill={isFavorite ? "white" : "none"} 
            className={isFavorite ? "text-white" : "text-white/70"} 
          />
        </button>
      </Link>
    </motion.div>
  )
})

PromptCard.displayName = 'PromptCard'