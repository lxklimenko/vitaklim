'use client'

import { createContext, useContext } from 'react'
import { useAuth } from '@/app/context/AuthContext'

interface BalanceContextType {
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
}

const BalanceContext = createContext<BalanceContextType | null>(null)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { balance, setBalance } = useAuth()

  return (
    <BalanceContext.Provider value={{ balance, setBalance }}>
      {children}
    </BalanceContext.Provider>
  )
}

export function useBalance() {
  const context = useContext(BalanceContext)

  if (!context) {
    throw new Error('useBalance must be used inside BalanceProvider')
  }

  return context
}