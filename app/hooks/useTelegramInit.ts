'use client'
import { useEffect } from 'react'

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

  }, [])
}