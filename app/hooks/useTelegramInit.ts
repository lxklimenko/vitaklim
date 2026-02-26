'use client'
import { useEffect } from 'react'

// Расширяем глобальный интерфейс Window только для используемых методов
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        disableVerticalSwipes?: () => void
      }
    }
  }
}

export function useTelegramInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.Telegram?.WebApp) return

    const tg = window.Telegram.WebApp

    // Базовая инициализация Telegram WebApp
    tg.ready()
    tg.expand()
    tg.disableVerticalSwipes?.()
  }, [])
}