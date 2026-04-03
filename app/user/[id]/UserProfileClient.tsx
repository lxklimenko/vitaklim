'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Navigation } from '../../components/Navigation'

interface Profile {
  id: string
  telegram_first_name: string | null
  telegram_username: string | null
  telegram_avatar_url: string | null
  created_at: string
}

interface Generation {
  id: string
  image_url: string
  prompt: string
  created_at: string
}

export default function UserProfileClient({
  profile,
  generations,
}: {
  profile: Profile
  generations: Generation[]
}) {
  const router = useRouter()
  const displayName = profile.telegram_first_name || 
                      (profile.telegram_username ? `@${profile.telegram_username}` : 'Пользователь')

  return (
    <div className="bg-black text-white min-h-screen pb-28">

      {/* Хедер */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition"
        >
          <ChevronLeft size={22} className="text-white/60" />
        </button>
        <h1 className="text-[16px] font-semibold">{displayName}</h1>
      </header>

      {/* Профиль */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-5">
          {/* Аватар */}
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[28px] font-bold shrink-0">
            {profile.telegram_avatar_url ? (
              <img
                src={profile.telegram_avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{displayName[0].toUpperCase()}</span>
            )}
          </div>

          {/* Статистика */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-[20px] font-bold">{generations.length}</p>
              <p className="text-[11px] text-white/40 mt-0.5">публикаций</p>
            </div>
          </div>
        </div>

        {/* Имя */}
        <div className="mt-4">
          <p className="text-[16px] font-semibold">{displayName}</p>
          {profile.telegram_username && (
            <p className="text-[13px] text-white/40 mt-0.5">@{profile.telegram_username}</p>
          )}
        </div>
      </div>

      {/* Разделитель */}
      <div className="h-px bg-white/5" />

      {/* Сетка генераций */}
      {generations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/20">
          <p className="text-[15px]">Нет публичных генераций</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          {generations.map((gen) => (
            <Link
              key={gen.id}
              href={`/generation/${gen.id}`}
              className="relative aspect-square bg-white/5 overflow-hidden block"
            >
              <img
                src={gen.image_url}
                alt=""
                className="w-full h-full object-cover active:scale-95 transition-transform duration-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.parentElement!.style.display = 'none'
                }}
              />
            </Link>
          ))}
        </div>
      )}

      <Navigation />
    </div>
  )
}