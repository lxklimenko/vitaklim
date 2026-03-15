'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-client'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuth = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        router.push('/admin')
      } else {
        router.push('/')
      }
    }

    handleAuth()
  }, [])

  return (
    <div style={{ color: 'white', padding: 40 }}>
      Авторизация...
    </div>
  )
}