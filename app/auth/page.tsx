'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/')
    }, 1500) // 1.5 секунды

    return () => clearTimeout(timeout)
  }, [])

  return <div style={{ padding: 20 }}>Вход...</div>
}