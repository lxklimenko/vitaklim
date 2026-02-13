'use client'

import { useEffect, useState } from 'react'

export function useTelegram() {
  const [tgUser, setTgUser] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram) {
      const tg = (window as any).Telegram.WebApp
      tg.expand()

      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user)
      }
    }
  }, [])

  return tgUser
}
