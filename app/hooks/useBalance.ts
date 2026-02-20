import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useAuth } from '@/app/context/AuthContext'

export function useBalance() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const fetchBalance = async () => {
    if (!user) return

    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      setBalance(data.balance)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchBalance()
    } else {
      setBalance(0)
    }
  }, [user])

  return {
    balance,
    loading,
    fetchBalance,
    setBalance
  }
}