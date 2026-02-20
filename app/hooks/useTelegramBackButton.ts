'use client'
import { useEffect } from 'react'

export function useTelegramBackButton(callback: () => void) {
  useEffect(() => {
    if (!window.Telegram?.WebApp) return

    const backButton = window.Telegram.WebApp.BackButton

    backButton.show()
    backButton.onClick(callback)

    return () => {
      backButton.hide()
    }
  }, [callback])
}