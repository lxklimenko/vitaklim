'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { useImageGeneration } from '@/app/hooks/useImageGeneration';

export default function GenerateCore() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    generatePrompt,
    setGeneratePrompt,
    isGenerating,
    modelId,
    setModelId,
    aspectRatio,
    setAspectRatio,
    referencePreview,
    handleFileChange,
    handleRemoveImage,
    handleGenerate,
  } = useImageGeneration(user, () => {});

  return (
    <div className="min-h-screen bg-black text-white pb-28 px-4">

      {/* Header */}
      <div className="flex items-center gap-4 py-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/10 transition"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Создание изображения</h1>
      </div>

      {/* Prompt input */}
      <div className="space-y-6 max-w-xl mx-auto">

        <textarea
          value={generatePrompt}
          onChange={(e) => setGeneratePrompt(e.target.value)}
          placeholder="Опишите изображение..."
          className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 resize-none focus:outline-none focus:border-white/30 transition"
        />

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-white text-black font-bold rounded-2xl py-4 hover:bg-gray-200 transition disabled:opacity-50"
        >
          {isGenerating ? 'Генерация...' : 'Создать'}
        </button>

      </div>
    </div>
  );
}