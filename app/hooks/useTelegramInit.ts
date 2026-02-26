'use client'
import { useEffect } from 'react'

// Расширяем глобальный интерфейс Window для поддержки Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        setHeaderColor: (color: string) => void
        setBackgroundColor: (color: string) => void
        disableVerticalSwipes?: () => void
        colorScheme?: 'light' | 'dark'
        viewportHeight?: number
        viewportStableHeight?: number
        BackButton: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
      }
    }
  }
}

export function useTelegramInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.Telegram?.WebApp) return

    const tg = window.Telegram.WebApp

    tg.ready()

    // Разворачиваем на максимум
    tg.expand()

    // Отключаем вертикальный свайп (чтобы не сворачивалось)
    tg.disableVerticalSwipes?.()

    // Определяем тему Telegram
    const isDark = tg.colorScheme === 'dark'
    const bgColor = isDark ? '#000000' : '#ffffff'

    // Красим системные зоны Telegram
    tg.setHeaderColor(bgColor)
    tg.setBackgroundColor(bgColor)

    // Убираем bounce-эффект на iOS
    document.body.style.overscrollBehaviorY = 'none'

    // Фиксим высоту для корректного отображения в Telegram WebView
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'

    // Добавляем класс в body для темы
    document.body.dataset.theme = isDark ? 'dark' : 'light'

    // Устанавливаем CSS-переменную для корректировки отступов
    // (например, для избегания наложения панели навигации)
    if (tg.viewportHeight && tg.viewportStableHeight) {
      document.documentElement.style.setProperty(
        '--tg-top',
        `${tg.viewportStableHeight - tg.viewportHeight}px`
      )
    }
  }, [])
}