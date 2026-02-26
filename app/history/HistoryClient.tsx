'use client'

import { useEffect, useState } from 'react'
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

  const [generations, setLocalGenerations] =
    useState<Generation[]>(initialGenerations)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!user) return;

    setDeletingId(id);

    try {
      const response = await fetch("/api/delete-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(result.error);
        return;
      }

      setLocalGenerations(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Необходимо войти в аккаунт</p>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-24 bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <h1 className="text-2xl font-bold mb-6">
            История генераций
          </h1>

          {generations.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              История пока пуста
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="relative w-full aspect-square rounded-3xl overflow-hidden bg-zinc-900 shadow-lg group"
                >
                  <Link
                    href={`/generation/${gen.id}/`}
                    className="absolute inset-0 z-0"
                  >
                    {gen.storage_path ? (
                      <Image
                        src={gen.image_url ?? ''}
                        alt="Generated"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-neutral-900 text-neutral-500 text-sm">
                        {gen.status === 'pending' && 'Генерация...'}
                        {gen.status === 'failed' && 'Ошибка генерации'}
                      </div>
                    )}
                  </Link>

                  {/* Кнопка удаления — открывает подтверждение */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setConfirmDeleteId(gen.id)
                    }}
                    className="absolute top-3 left-3 z-10
                               w-10 h-10
                               flex items-center justify-center
                               rounded-2xl
                               bg-black/50
                               backdrop-blur-md
                               border border-white/20"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Navigation />
      </div>

      {/* Модальное окно подтверждения удаления */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">
              Удалить генерацию?
            </h3>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                Отмена
              </button>

              <button
                disabled={deletingId === confirmDeleteId}
                onClick={() => {
                  handleDelete(confirmDeleteId)
                  setConfirmDeleteId(null)
                }}
                className={`px-4 py-2 rounded-xl transition ${
                  deletingId === confirmDeleteId
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deletingId === confirmDeleteId ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}