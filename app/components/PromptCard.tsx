'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, Check, Copy, ImageOff } from 'lucide-react'
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
  handleCopy,
  copiedId,
  priority = false
}: PromptCardProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const isFavorite = favorites.includes(prompt.id)

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
      layout={!isMobile}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration: 0.15,
        layout: { duration: 0.1 }
      }}
      className="flex flex-col group cursor-pointer"
      data-prompt-id={prompt.id}
    >
      {/* Обернули контейнер изображения в Link */}
      <Link 
        href={`/prompt/${prompt.id}`}
        className="relative aspect-[3/4] rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-[#111] to-[#222] mb-2 group block"
        onClick={(e) => {
          // Если клик произошел по кнопке лайка, предотвращаем переход
          if ((e.target as HTMLElement).closest('button')) {
            e.preventDefault()
          }
        }}
      >
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
          <Image 
            src={prompt.image?.src || "/placeholder.jpg"} 
            alt={prompt.title}
            quality={75}
            priority={priority}
            fill
            sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
            className={`
              object-cover
              transition-all duration-300 ease-out
              group-hover:scale-105
              ${isLoading ? 'opacity-0' : 'opacity-100'}
            `}
            onLoadingComplete={handleImageLoad}
            onError={handleImageError}
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
          onClick={(e) => { 
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(e, prompt.id)
          }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/50 hover:text-white transition-colors z-10"
          aria-label={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
        >
          <Heart size={14} fill={isFavorite ? "white" : "none"} className={isFavorite ? "text-white" : ""} />
        </button>
      </Link>

      {/* Текстовый блок ПОД фото */}
      <div className="px-1 space-y-1">
        <button 
          onClick={(e) => { 
            e.preventDefault()
            e.stopPropagation()
            handleCopy(prompt.id, prompt.prompt || "", prompt.price)
          }}
          className={`w-full py-2 backdrop-blur-lg border rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
            copiedId === prompt.id 
              ? 'bg-white border-white text-black hover:bg-white/90' 
              : 'bg-white/[0.08] border-white/5 text-white/90 hover:bg-white/[0.12]'
          }`}
          aria-label={copiedId === prompt.id ? "Текст скопирован" : `Скопировать промпт за ${prompt.price} ₽`}
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