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

interface Props {
  newGenerations: Generation[]
  topGenerations: Generation[]
}

export default function FeedClient({ newGenerations, topGenerations }: Props) {
  const { user, authReady, profileReady, telegramUsername, telegramFirstName } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'top'>('new')
  const [likes, setLikes] = useState<Record<string, number>>({})
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const generations = activeTab === 'new' ? newGenerations : topGenerations

  useEffect(() => {
    const fetchLikes = async () => {
      const ids = generations.map(g => g.id)
      if (ids.length === 0) return

      const { data } = await supabase
        .from('likes')
        .select('generation_id')
        .in('generation_id', ids)

      const counts: Record<string, number> = {}
      data?.forEach(l => {
        counts[l.generation_id] = (counts[l.generation_id] || 0) + 1
      })
      setLikes(counts)

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
    if (!user) { router.push('/profile'); return }

    const isLiked = likedByMe.has(generationId)
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
      await supabase.from('likes').delete()
        .eq('user_id', user.id).eq('generation_id', generationId)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, generation_id: generationId })
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

      {/* Заголовок + вкладки */}
      <div className="px-4 pt-6 pb-0">
        <h1 className="text-[28px] font-bold tracking-tight mb-4">Лента</h1>

        <div className="flex gap-1 bg-white/[0.05] rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-2 rounded-xl text-[14px] font-medium transition-all ${
              activeTab === 'new'
                ? 'bg-white text-black'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Новое
          </button>
          <button
            onClick={() => setActiveTab('top')}
            className={`flex-1 py-2 rounded-xl text-[14px] font-medium transition-all ${
              activeTab === 'top'
                ? 'bg-white text-black'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Топ недели
          </button>
        </div>
      </div>

      {/* Сетка */}
      <div className="mt-3">
        {generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/20">
            <p className="text-[15px]">Пока нет публичных генераций</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {generations.map((gen) => {
              if (!gen.image_url) return null
              const authorName = gen.profiles?.telegram_first_name ||
                                gen.profiles?.telegram_username || 'Аноним'
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
                    className="w-full h-full object-cover transition-transform duration-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.parentElement!.style.display = 'none'
                    }}
                  />

                  <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/70 to-transparent" />

                  {/* Лайк */}
                  <button
                    onClick={(e) => toggleLike(e, gen.id)}
                    className="absolute top-1.5 right-1.5 flex flex-col items-center gap-0.5 z-10 bg-black/30 backdrop-blur-sm rounded-full p-1"
                  >
                    <Heart
                      size={14}
                      className={`transition-all duration-200 ${
                        isLiked ? 'text-red-500 fill-red-500' : 'text-white/70'
                      }`}
                    />
                    {likeCount > 0 && (
                      <span className="text-[8px] text-white font-bold">{likeCount}</span>
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
      </div>

      <Navigation />
    </div>
  )
}