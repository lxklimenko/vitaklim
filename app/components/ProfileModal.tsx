'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Copy, Zap, Loader2, UserPlus } from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import { toast } from 'sonner'

interface ProfileModalProps {
  user: any
  balance: number
  purchases: any[]
  isProfileOpen: boolean
  setIsProfileOpen: (v: boolean) => void
  handleTopUp: (amount: number) => void
  isTopUpLoading: boolean
  email: string
  password: string
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  authMode: 'login' | 'register'
  setAuthMode: (v: 'login' | 'register') => void
  handleAuth: () => void
}

export function ProfileModal({
  user,
  balance,
  purchases,
  isProfileOpen,
  setIsProfileOpen,
  handleTopUp,
  isTopUpLoading,
  email,
  password,
  setEmail,
  setPassword,
  authMode,
  setAuthMode,
  handleAuth
}: ProfileModalProps) {

  return (
    <AnimatePresence>
      {isProfileOpen && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setIsProfileOpen(false)} 
          />

          <motion.div
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative bg-[#111] w-full h-[95vh] md:h-auto md:max-w-xl md:rounded-[2.5rem] overflow-hidden shadow-2xl z-10 flex flex-col"
          >
            <button 
              onClick={() => setIsProfileOpen(false)} 
              className="absolute top-6 right-6 z-[30] p-2 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"
            >
              <X size={20} />
            </button>

            {user ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center p-8">
                  <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-1.5 py-1.5">
                    <span className="text-[12px] font-semibold text-white/40">Баланс</span>
                    <div className="h-6 px-3 rounded-xl bg-white/10 flex items-center">
                      <span className="text-[13px] font-bold italic text-white">{balance} ₽</span>
                    </div>
                  </div>
                </div>

                <div className="px-10 mb-8">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {user?.email?.split('@')[0]}
                  </h2>
                </div>

                <div className="px-8 mb-6">
                  <button 
                    onClick={() => handleTopUp(10)} 
                    disabled={isTopUpLoading}
                    className="w-full bg-white text-black py-4 rounded-2xl flex items-center justify-center gap-3 font-bold"
                  >
                    {isTopUpLoading ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
                    Пополнить баланс на 10 ₽
                  </button>
                </div>

                <div className="px-8 pb-10 mt-auto"> 
                  <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full py-4 text-red-500/60 border border-red-500/10 rounded-2xl"
                  >
                    Завершить сессию
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-10 flex flex-col h-full justify-center space-y-8">
                <div className="text-center">
                  <h2 className="text-4xl font-bold italic uppercase mb-2">Sync Vision</h2>
                  <p className="text-sm text-white/30">
                    {authMode === 'login' ? 'Войдите, чтобы продолжить' : 'Создайте аккаунт'}
                  </p>
                </div>

                <div className="space-y-3">
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full bg-white/5 rounded-2xl py-4 px-5"
                  />
                  <input 
                    type="password" 
                    placeholder="Пароль" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full bg-white/5 rounded-2xl py-4 px-5"
                  />
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleAuth} 
                    className="w-full py-4 rounded-2xl bg-white text-black font-bold"
                  >
                    {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                  </button>

                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
                    className="w-full py-4 rounded-2xl bg-white/5 text-white/80"
                  >
                    {authMode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт?'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}