'use client'

import { useEffect } from 'react'

export default function AuthPage() {
  useEffect(() => {
    const run = async () => {
      await new Promise(res => setTimeout(res, 1500))

      const userId = localStorage.getItem("userId")

      if (!userId) {
        window.location.href = '/'
        return
      }

      const res = await fetch('/api/auth/max-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      }
    }

    run()
  }, [])

  return <div>Переход в Max...</div>
}