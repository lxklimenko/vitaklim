'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Navigation } from '@/app/components/Navigation'
import { useAuth } from '@/app/context/AuthContext'
import { supabase } from '@/app/lib/supabase'
import { Generation } from '@/app/types'

interface Props {
  initialGenerations: Generation[]
}

export default function HistoryClient({ initialGenerations }: Props) {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const userIdFromUrl = searchParams.get('u')
  const isGuestMode = !!userIdFromUrl && (!user || user.id !== userIdFromUrl)

  const [generations, setLocalGenerations] = useState<Generation[]>(initialGenerations)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [hasMore, setHasMore] = useState(initialGenerations.length === 10)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(isGuestMode && initialGenerations.length === 0)

  // Загрузка для гостя через VIP-маршрут
  useEffect(() => {
    async function fetchGuestHistory() {
      if (!userIdFromUrl) return
      try {
        const res = await fetch(`/api/history/guest?u=${userIdFromUrl}&offset=0`)
        const data = await res.json()

        if (data.generations) {
          setLocalGenerations(data.generations)
          setHasMore(data.hasMore)
        }
      } catch (error) {
        console.error('Error fetching guest history:', error)
      } finally {
        setIsInitialLoading(false)
      }
    }

    if (isGuestMode && initialGenerations.length === 0) {
      fetchGuestHistory()
    }
  }, [userIdFromUrl, isGuestMode, initialGenerations.length])

  const handleDelete = async (id: string) => {
    if (!user || isGuestMode) return
    setDeletingId(id)
    try {
      const response = await fetch('/api/delete-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) return
      setLocalGenerations(prev => prev.filter(g => g.id !== id))
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const loadMore = async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const offset = generations.length
      const url = userIdFromUrl
        ? `/api/history/guest?offset=${offset}&u=${userIdFromUrl}`
        : `/api/history/load-more?offset=${offset}`
      
      const res = await fetch(url)
      const data = await res.json()

      if (data.generations) {
        setLocalGenerations(prev => [...prev, ...data.generations])
        setHasMore(data.hasMore)
      }
    } catch (error) {
      console.error('Load more error:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (!user && !userIdFromUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Необходимо войти в аккаунт</p>
      </div>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-24 bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <h1 className="text-2xl font-bold mb-6">
            {isGuestMode ? "Ваша история (Просмотр)" : "История генераций"}
          </h1>

          {generations.length === 0 ? (
            <div className="text-center text-gray-500 py-20">История пока пуста</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {generations.map(gen => (
                <div key={gen.id} className="relative w-full aspect-square rounded-3xl overflow-hidden bg-zinc-900 shadow-lg group">
                  <Link href={`/generation/${gen.id}/`} className="absolute inset-0 z-0">
                    {gen.storage_path ? (
                      <Image src={gen.image_url ?? ''} alt="Generated" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-neutral-900 text-neutral-500 text-sm">
                        Генерация...
                      </div>
                    )}
                  </Link>
                  {!isGuestMode && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(gen.id) }}
                      className="absolute top-3 left-3 z-10 w-10 h-10 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-md border border-white/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button onClick={loadMore} disabled={isLoadingMore} className="px-8 py-3 rounded-2xl bg-zinc-900 border border-white/10 hover:bg-zinc-800 transition disabled:opacity-50">
                {isLoadingMore ? 'Загрузка...' : 'Показать еще'}
              </button>
            </div>
          )}
        </div>
        <Navigation />
      </div>
    </>
  )
}