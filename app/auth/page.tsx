'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()

  useEffect(() => {
    // просто редиректим на главную
    router.replace('/')
  }, [])

  return <div>Вход...</div>
}