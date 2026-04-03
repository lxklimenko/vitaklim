'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Navigation } from '../components/Navigation'
import { Header } from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'

interface Generation {
  id: string
  image_url: string
  prompt: string
  created_at: string
  user_id: string
  profiles: {
    telegram_first_name: string | null
    telegram_username: string | null
    telegram_avatar_url: string | null
  } | null
}

export default function FeedClient({ generations }: { generations: Generation[] }) {
  const { user, authReady, profileReady, telegramUsername, telegramFirstName } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)

  // Фильтруем только те у которых есть картинка
  const validGenerations = generations.filter(g => 
    g.image_url && !g.image_url.includes('sign/generations-private') || 
    g.image_url?.includes('token=')
  )

  return (
    <div className="bg-black text-white min-h-screen pb-28">
      <Header
        user={user}
        authReady={authReady}
        profileReady={profileReady}
        telegramUsername={telegramUsername}
        telegramFirstName={telegramFirstName}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        onOpenProfile={() => router.push('/profile')}
        onResetView={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      {/* Заголовок */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/30 mb-1">
          Сообщество
        </p>
        <h1 className="text-[28px] font-bold tracking-tight">Лента</h1>
      </div>

      {/* Сетка */}
      {generations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/20">
          <p className="text-[15px]">Пока нет публичных генераций</p>
          <p className="text-[13px] mt-1">Будь первым — сгенерируй и опубликуй!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {generations.map((gen) => {
            if (!gen.image_url) return null

            const authorName = gen.profiles?.telegram_first_name || 
                              gen.profiles?.telegram_username || 
                              'Аноним'

            return (
              <Link
                key={gen.id}
                href={`/generation/${gen.id}`}
                className="relative aspect-square bg-white/5 overflow-hidden group block"
              >
                <img
                  src={gen.image_url}
                  alt=""
                  className="w-full h-full object-cover group-active:scale-95 transition-transform duration-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.parentElement!.style.display = 'none'
                  }}
                />

                {/* Оверлей снизу */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Аватар автора */}
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-4 h-4 rounded-full overflow-hidden bg-white/20 shrink-0">
                    {gen.profiles?.telegram_avatar_url ? (
                      <img
                        src={gen.profiles.telegram_avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/30 flex items-center justify-center text-[7px] font-bold">
                        {authorName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-white font-medium truncate max-w-12.5 drop-shadow">
                    {authorName}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Navigation />
    </div>
  )
}