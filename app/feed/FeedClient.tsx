'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Navigation } from '../components/Navigation'
import { Header } from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-client'

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
  const [likes, setLikes] = useState<Record<string, number>>({})
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set())
  const supabase = createClient()

  // Загружаем лайки
  useEffect(() => {
    const fetchLikes = async () => {
      const ids = generations.map(g => g.id)
      if (ids.length === 0) return

      // Считаем лайки для каждой генерации
      const { data } = await supabase
        .from('likes')
        .select('generation_id')
        .in('generation_id', ids)

      const counts: Record<string, number> = {}
      data?.forEach(l => {
        counts[l.generation_id] = (counts[l.generation_id] || 0) + 1
      })
      setLikes(counts)

      // Загружаем мои лайки
      if (user) {
        const { data: myLikes } = await supabase
          .from('likes')
          .select('generation_id')
          .in('generation_id', ids)
          .eq('user_id', user.id)

        setLikedByMe(new Set(myLikes?.map(l => l.generation_id) || []))
      }
    }

    fetchLikes()
  }, [generations, user])

  const toggleLike = async (e: React.MouseEvent, generationId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push('/profile')
      return
    }

    const isLiked = likedByMe.has(generationId)

    // Оптимистичное обновление
    setLikedByMe(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(generationId)
      else next.add(generationId)
      return next
    })
    setLikes(prev => ({
      ...prev,
      [generationId]: (prev[generationId] || 0) + (isLiked ? -1 : 1)
    }))

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('generation_id', generationId)
    } else {
      await supabase
        .from('likes')
        .insert({ user_id: user.id, generation_id: generationId })
    }
  }

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

      <div className="px-4 pt-6 pb-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/30 mb-1">
          Сообщество
        </p>
        <h1 className="text-[28px] font-bold tracking-tight">Лента</h1>
      </div>

      {generations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/20">
          <p className="text-[15px]">Пока нет публичных генераций</p>
          <p className="text-[13px] mt-1">Будь первым — сгенерируй и опубликуй!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {generations.map((gen) => {
            if (!gen.image_url) return null

            const authorName = gen.profiles?.telegram_first_name ||
                              gen.profiles?.telegram_username ||
                              'Аноним'
            const isLiked = likedByMe.has(gen.id)
            const likeCount = likes[gen.id] || 0

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

                {/* Градиент снизу */}
                <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/70 to-transparent" />

                {/* Лайк */}
                <button
                  onClick={(e) => toggleLike(e, gen.id)}
                  className="absolute top-2 right-2 flex flex-col items-center gap-0.5 z-10"
                >
                  <Heart
                    size={18}
                    className={`drop-shadow transition-all duration-200 ${
                      isLiked ? 'text-red-500 fill-red-500 scale-110' : 'text-white/70'
                    }`}
                  />
                  {likeCount > 0 && (
                    <span className="text-[9px] text-white font-bold drop-shadow">
                      {likeCount}
                    </span>
                  )}
                </button>

                {/* Автор */}
                <Link
                  href={`/user/${gen.user_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-1.5 left-1.5 flex items-center gap-1"
                >
                  <div className="w-4 h-4 rounded-full overflow-hidden bg-white/20 flex-shrink-0">
                    {gen.profiles?.telegram_avatar_url ? (
                      <img src={gen.profiles.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/30 flex items-center justify-center text-[7px] font-bold">
                        {authorName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-white font-medium truncate max-w-[50px] drop-shadow">
                    {authorName}
                  </span>
                </Link>
              </Link>
            )
          })}
        </div>
      )}

      <Navigation />
    </div>
  )
}