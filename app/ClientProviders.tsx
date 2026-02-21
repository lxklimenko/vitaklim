'use client'

import { AuthProvider } from '@/app/context/AuthContext'

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}