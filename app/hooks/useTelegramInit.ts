'use client'
import { useEffect } from 'react'

export function useTelegramInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.Telegram?.WebApp) return

    const tg = window.Telegram.WebApp

    tg.ready()
    tg.expand()

    // Чёрный верх
    tg.setHeaderColor('#000000')

    // Фон Telegram за пределами твоего приложения
    tg.setBackgroundColor('#000000')

    // Отключаем лишние анимации iOS
    tg.disableVerticalSwipes?.()

  }, [])
}