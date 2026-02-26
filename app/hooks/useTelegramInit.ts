'use client'
import { useEffect } from 'react'

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