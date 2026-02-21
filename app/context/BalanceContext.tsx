'use client'

import { createContext, useContext, useState } from 'react'

interface BalanceContextType {
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
}

const BalanceContext = createContext<BalanceContextType | null>(null)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(0)

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