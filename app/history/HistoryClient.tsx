'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Navigation } from '@/app/components/Navigation'
import { GenerateModal } from '@/app/components/GenerateModal'
import { useAuth } from '@/app/context/AuthContext'
import { useImageGeneration } from '@/app/hooks/useImageGeneration'
import { supabase } from '@/app/lib/supabase'
import { Generation } from '@/app/types'

interface Props {
  initialGenerations: Generation[]
}

export default function HistoryClient({ initialGenerations }: Props) {
  const {
    user,
    setGenerations,
    fetchProfile
  } = useAuth()

  const [generations, setLocalGenerations] =
    useState<Generation[]>(initialGenerations)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const imageGen = useImageGeneration(
    user,
    () => {
      setIsModalOpen(false)
    },
    fetchProfile
  )

  console.log("CURRENT PROMPT:", imageGen.generatePrompt)

  useEffect(() => {
    setGenerations(initialGenerations)
  }, [initialGenerations, setGenerations])

  const handleDelete = async (id: string) => {
    if (!user) return

    const generation = generations.find(g => g.id === id)
    if (!generation) return

    try {
      // 1. Удаляем файл из Storage
      const filePath = generation.image_url.split('/generations/')[1]

      if (filePath) {
        await supabase.storage
          .from('generations')
          .remove([filePath])
      }

      // 2. Удаляем запись из БД
      await supabase
        .from('generations')
        .delete()
        .eq('id', id)

      // 3. Обновляем UI
      const updated = generations.filter((g) => g.id !== id)
      setLocalGenerations(updated)
      setGenerations(updated)

    } catch (error) {
      console.error("Delete error:", error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Необходимо войти в аккаунт</p>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-24">
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
                    <Image
                      src={gen.image_url}
                      alt="Generated"
                      fill
                      className="object-cover"
                    />
                  </Link>

                  {/* Кнопка удаления */}
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
                               border border-white/20
                               opacity-100
                               md:opacity-0
                               md:group-hover:opacity-100
                               transition-all duration-200
                               hover:bg-red-500/20
                               hover:scale-105"
                  >
                    <Trash2 size={18} />
                  </button>

                  {/* Блок подтверждения удаления */}
                  {confirmDeleteId === gen.id && (
                    <div className="absolute inset-0 z-20 
                                    flex items-center justify-center
                                    bg-black/70 backdrop-blur-md">
                      <div className="bg-[#141414]
                                      border border-white/10
                                      rounded-2xl
                                      p-4
                                      text-center
                                      space-y-4">
                        <p className="text-sm text-white/80">
                          Удалить генерацию?
                        </p>
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setConfirmDeleteId(null)
                            }}
                            className="px-4 py-2 rounded-xl 
                                       bg-white/5 
                                       hover:bg-white/10 
                                       transition text-sm"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDelete(gen.id)
                              setConfirmDeleteId(null)
                            }}
                            className="px-4 py-2 rounded-xl 
                                       bg-red-500/20 
                                       text-red-400
                                       hover:bg-red-500/30
                                       transition text-sm"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Navigation onOpenGenerator={() => setIsModalOpen(true)} />
      </div>

      <GenerateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        generatePrompt={imageGen.generatePrompt}
        setGeneratePrompt={imageGen.setGeneratePrompt}
        isGenerating={imageGen.isGenerating}
        handleGenerate={imageGen.handleGenerate}
        modelId={imageGen.modelId}
        setModelId={imageGen.setModelId}
        aspectRatio={imageGen.aspectRatio}
        setAspectRatio={imageGen.setAspectRatio}
        referenceImage={imageGen.referenceImage}
        handleFileChange={imageGen.handleFileChange}
        handleRemoveImage={imageGen.handleRemoveImage}
      />
    </>
  )
}