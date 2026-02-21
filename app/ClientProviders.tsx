'use client'

import { AuthProvider } from '@/app/context/AuthContext'
import { BalanceProvider } from '@/app/context/BalanceContext'

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <BalanceProvider>
        {children}
      </BalanceProvider>
    </AuthProvider>
  )
}