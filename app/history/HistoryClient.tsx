'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Trash2, RefreshCw } from 'lucide-react'
import { Navigation } from '@/app/components/Navigation'
import { GenerateModal } from '@/app/components/GenerateModal'
import { useAuth } from '@/app/hooks/useAuth'
import { useImageGeneration } from '@/app/hooks/useImageGeneration'
import { supabase } from '@/app/lib/supabase'
import { Generation } from '@/app/types'

interface Props {
  initialGenerations: Generation[]
}

export default function HistoryClient({ initialGenerations }: Props) {
  const {
    user,
    setGenerations
  } = useAuth()

  const [generations, setLocalGenerations] =
    useState<Generation[]>(initialGenerations)

  const [isModalOpen, setIsModalOpen] = useState(false)

  // 🔥 подключаем генерацию правильно
  const imageGen = useImageGeneration(user, () => {
    setIsModalOpen(false)
  })

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
                  className="bg-zinc-900 rounded-2xl p-4 shadow-lg"
                >
                  {gen.image_url && (
                    <div className="relative w-full h-64 mb-4 rounded-xl overflow-hidden">
                      <Image
                        src={gen.image_url}
                        alt="Generated"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  <p className="text-sm text-gray-300 mb-4">
                    {gen.prompt}
                  </p>

                  <div className="flex gap-4">
                    <button
                      onClick={() => handleDelete(gen.id)}
                      className="flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>

                    <button
                      onClick={() => {
                        imageGen.setGeneratePrompt(gen.prompt)
                        setIsModalOpen(true)
                      }}
                      className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition"
                    >
                      <RefreshCw size={16} />
                      Повторить
                    </button>
                  </div>
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