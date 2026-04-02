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
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  const { user, favorites, setFavorites, fetchProfile } = useAuth();

  const {
    generatePrompt, setGeneratePrompt, isGenerating,
    modelId, setModelId, aspectRatio, setAspectRatio,
    referencePreview, handleFileChange, handleRemoveImage, handleGenerate,
  } = useImageGeneration(user, () => setIsGenerateOpen(false));

  const actions = useAppActions(user, setFavorites, fetchProfile, () => {});

  useEffect(() => {
    if (staticPrompt) return;
    const fetchFromDb = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('generations').select('*').eq('id', id).single();
      if (data) {
        setDbPrompt({
          id: data.id, title: 'Моя генерация', tool: 'Vision AI',
          category: 'История', price: 0, prompt: data.prompt,
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
    <div className="bg-black text-white" style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>

      {/* Картинка — занимает всё пространство кроме нижней панели */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden bg-black"
        style={{ bottom: '220px' }}
      >
        <Image
          src={prompt.image.src}
          alt={prompt.title}
          fill
          className="object-cover object-top"
          priority
        />
        {/* Кнопка назад */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 transition active:scale-95"
        >
          <X size={18} className="text-white/80" />
        </button>
        {/* Градиент снизу */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-black to-transparent" />
      </div>

      {/* Нижняя панель — всегда приклеена к низу */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-black px-5 pt-4 flex flex-col gap-3"
        style={{ height: '220px', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Мета */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/30 mb-0.5">
              {prompt.tool}
            </p>
            <h1 className="text-[18px] font-bold text-white leading-tight">
              {prompt.title}
            </h1>
          </div>
          <button
            onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
            className={`w-10 h-10 flex items-center justify-center rounded-full border transition active:scale-95 ${
              isFavorite
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
            }`}
          >
            <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Промпт */}
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 overflow-y-auto" style={{ maxHeight: '60px' }}>
          <p className="text-[12px] leading-relaxed text-white/60">
            {prompt.prompt}
          </p>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2">
          <button
            onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-[13px] font-medium hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            {copiedId === prompt.id
              ? <><Check size={14} /> Скопировано</>
              : <><Copy size={14} /> Копировать</>
            }
          </button>
          <button
            onClick={() => {
              setGeneratePrompt(prompt.prompt);
              setIsGenerateOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white text-black font-semibold text-[13px] hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            <Sparkles size={14} />
            Сгенерировать
          </button>
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