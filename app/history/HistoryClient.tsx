'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Trash2, RefreshCw } from 'lucide-react'
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
    fetchProfile // 👈 добавляем fetchProfile
  } = useAuth()

  const [generations, setLocalGenerations] =
    useState<Generation[]>(initialGenerations)

  const [isModalOpen, setIsModalOpen] = useState(false)

  // 🔁 заменяем вызов хука – передаём fetchProfile третьим аргументом
  const imageGen = useImageGeneration(
    user,
    () => {
      setIsModalOpen(false)
    },
    fetchProfile
  )

  // Логируем текущий промпт при каждом рендере
  console.log("CURRENT PROMPT:", imageGen.generatePrompt)

  // синхронизация с auth
  useEffect(() => {
    setGenerations(initialGenerations)
  }, [initialGenerations, setGenerations])

  const handleDelete = async (id: string) => {
    if (!user) return

    await supabase.from('generations').delete().eq('id', id)

    const updated = generations.filter((g) => g.id !== id)
    setLocalGenerations(updated)
    setGenerations(updated)
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
            <div className="grid gap-6">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="group relative bg-zinc-900/60 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300"
                >
                  {gen.image_url && (
                    <div className="relative w-full aspect-[4/3] overflow-hidden">
                      <Image
                        src={gen.image_url}
                        alt="Generated"
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}

                  {/* Overlay кнопки */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleDelete(gen.id)}
                      className="p-2 rounded-xl bg-black/60 hover:bg-red-600/80 backdrop-blur text-white transition"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      onClick={() => {
                        imageGen.setGeneratePrompt(gen.prompt)
                        setIsModalOpen(true)
                      }}
                      className="p-2 rounded-xl bg-black/60 hover:bg-blue-600/80 backdrop-blur text-white transition"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>

                  <p className="absolute bottom-0 w-full text-sm text-white/80 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    {gen.prompt}
                  </p>
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