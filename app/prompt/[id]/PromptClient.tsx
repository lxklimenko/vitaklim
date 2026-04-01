'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { notFound, useParams } from 'next/navigation';
import { Loader2, X, Copy, Check, Heart, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { Prompt } from '../../types/prompt';
import { useAuth } from '@/app/context/AuthContext';
import { useAppActions } from '../../hooks/useAppActions';
import { useImageGeneration } from '../../hooks/useImageGeneration';
import { useTelegramBackButton } from '@/app/hooks/useTelegramBackButton';

const GenerateModal = dynamic(
  () => import('../../components/GenerateModal').then(m => m.GenerateModal),
  { ssr: false }
);

interface PromptClientProps {
  prompts: Prompt[];
}

export default function PromptClient({ prompts }: PromptClientProps) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useTelegramBackButton(() => router.back());

  const staticPrompt = prompts.find(p => p.id.toString() === id);
  const [dbPrompt, setDbPrompt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!staticPrompt);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const { user, favorites, setFavorites, fetchProfile } = useAuth();

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
  } = useImageGeneration(user, () => setIsGenerateOpen(false));

  const actions = useAppActions(user, setFavorites, fetchProfile, () => {});

  useEffect(() => {
    if (staticPrompt) return;
    const fetchFromDb = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('generations')
        .select('*')
        .eq('id', id)
        .single();
      if (data) {
        setDbPrompt({
          id: data.id,
          title: 'Моя генерация',
          tool: 'Vision AI',
          category: 'История',
          price: 0,
          prompt: data.prompt,
          image: { src: data.image_url, width: 1024, height: 1024, aspect: '1:1' },
          description: 'Сгенерировано пользователем'
        });
      }
      setIsLoading(false);
    };
    fetchFromDb();
  }, [id, staticPrompt]);

  const prompt = staticPrompt || dbPrompt;
  const isFavorite = favorites.includes(prompt?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  if (!prompt || !prompt.image) return notFound();

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col">

      {/* Кнопка назад */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/80 transition-all"
        >
          <X size={18} className="text-white/70" />
        </button>
      </div>

      {/* Основной контент — горизонтально */}
      <div className="flex flex-col md:flex-row h-full">

        {/* Левая часть — картинка */}
        <div className="relative flex-1 overflow-hidden">
          {/* Размытый фон */}
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${prompt.image.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(40px)',
              opacity: 0.3,
            }}
          />
          {/* Картинка */}
          <div className="relative z-10 h-full flex items-center justify-center p-6 pt-16">
            <Image
              src={prompt.image.src}
              alt={prompt.title}
              width={800}
              height={1000}
              className="max-h-full w-auto object-contain rounded-2xl shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* Правая часть — инфо */}
        <div className="w-full md:w-[340px] flex flex-col justify-between p-6 pt-16 border-t md:border-t-0 md:border-l border-white/5">

          {/* Верх — мета */}
          <div className="space-y-1 mb-4">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/30">
              {prompt.category}
            </p>
            <h1 className="text-[18px] font-bold text-white leading-tight">
              {prompt.title}
            </h1>
            <p className="text-[12px] text-white/40">{prompt.tool}</p>
          </div>

          {/* Промпт */}
          <div className="flex-1 flex flex-col min-h-0 mb-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-white/25 mb-2">
              Промпт
            </p>
            <div className="flex-1 overflow-y-auto no-scrollbar bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[13px] leading-relaxed text-white/70 whitespace-pre-wrap select-all">
                {prompt.prompt}
              </p>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/8 text-white/60 text-[13px] font-medium hover:bg-white/10 hover:text-white transition active:scale-95"
              >
                {copiedId === prompt.id
                  ? <><Check size={15} /> Скопировано</>
                  : <><Copy size={15} /> Копировать</>
                }
              </button>

              <button
                onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
                className={`w-12 flex items-center justify-center rounded-2xl border transition active:scale-95 ${
                  isFavorite
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-white/5 border-white/8 text-white/50 hover:bg-white/10'
                }`}
              >
                <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
              </button>
            </div>

            <button
              onClick={() => {
                setGeneratePrompt(prompt.prompt);
                setIsGenerateOpen(true);
              }}
              className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-[15px] flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <Sparkles size={16} />
              Сгенерировать
            </button>
          </div>
        </div>
      </div>

      {isGenerateOpen && (
        <GenerateModal
          isOpen={isGenerateOpen}
          onClose={() => setIsGenerateOpen(false)}
          generatePrompt={generatePrompt}
          setGeneratePrompt={setGeneratePrompt}
          isGenerating={isGenerating}
          handleGenerate={handleGenerate}
          modelId={modelId}
          setModelId={setModelId}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          referencePreview={referencePreview}
          handleFileChange={handleFileChange}
          handleRemoveImage={handleRemoveImage}
        />
      )}
    </div>
  );
}
