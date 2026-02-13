'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound, useParams } from 'next/navigation';
import { Loader2, X, Copy, Check, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

import { Prompt } from '../../types/prompt';
import { useAuth } from '../../hooks/useAuth';
import { useAppActions } from '../../hooks/useAppActions';
import { useImageGeneration } from '../../hooks/useImageGeneration';

// Динамический импорт модалки (без SSR)
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

  // 1. Ищем в статичных промптах
  const staticPrompt = prompts.find(p => p.id.toString() === id);

  // 2. Стейт для данных из базы (если история)
  const [dbPrompt, setDbPrompt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!staticPrompt);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Стейт для открытия модалки генерации
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  // Хуки авторизации и действий (переносим вверх)
  const { user, favorites, setFavorites, setGenerations, fetchProfile } = useAuth();

  // Хук генерации — теперь используем user и колбэк закрытия
  const {
    generatePrompt,
    setGeneratePrompt,
    isGenerating,
    modelId,
    setModelId,
    aspectRatio,
    setAspectRatio,
    referenceImage,
    handleFileChange,
    handleRemoveImage,
    handleGenerate,
  } = useImageGeneration(user, () => {
    setIsGenerateOpen(false);
  });

  const setIsProfileOpen = () => {};
  const actions = useAppActions(user, setGenerations, setFavorites, fetchProfile, setIsProfileOpen);

  // 3. Если нет в статике — грузим из Supabase
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
          image: {
            src: data.image_url,
            width: 1024,
            height: 1024,
            aspect: '1:1'
          },
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!prompt || !prompt.image) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Кнопка закрытия (назад) — премиум-стиль */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center 
                     rounded-full 
                     bg-black/50 
                     backdrop-blur-md 
                     border border-white/20 
                     hover:bg-black/70 
                     hover:scale-105
                     transition-all duration-200"
        >
          <X size={20} />
        </button>
      </div>

      {/* Image block — во всю ширину с фоном #0a0a0a */}
      <div className="w-full bg-[#0a0a0a] flex justify-center">
        <div className="w-full">
          <Image
            src={prompt.image.src}
            alt={prompt.title}
            width={1600}
            height={1200}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>

      {/* Блок с описанием — обновлённый дизайн */}
      <div className="max-w-4xl mx-auto px-6 mt-6">
        <div className="bg-gradient-to-b from-[#141414] to-[#0f0f0f]
                      border border-white/10
                      rounded-3xl
                      p-6
                      space-y-6
                      transition-all duration-300
                      hover:border-white/20">

          {/* Заголовок */}
          <div className="flex items-center justify-between">
            <div className="text-white/40 text-xs tracking-widest uppercase">
              Nano Banano Pro
            </div>

            {/* subtle декоративная точка */}
            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
          </div>

          {/* Контейнер текста с кнопками действий */}
          <div className="flex gap-4">
            {/* Текст — фиксированная высота, внутренний отступ снизу */}
            <div className="relative flex-1 h-44">
              <div className="overflow-y-auto 
                              hide-scrollbar
                              pr-2 
                              pb-4
                              text-white/90 
                              text-sm 
                              leading-relaxed 
                              whitespace-pre-wrap 
                              h-full">
                {prompt.prompt}
              </div>

              {/* Верхний fade */}
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 
                              bg-gradient-to-b from-[#141414] to-transparent" />

              {/* Нижний fade */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 
                              bg-gradient-to-t from-[#0f0f0f] to-transparent" />
            </div>

            {/* Кнопки справа */}
            <div className="flex flex-col gap-3">
              {/* Copy */}
              <button
                onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
                className="w-10 h-10 flex items-center justify-center 
                           rounded-xl 
                           bg-white/5 
                           hover:bg-white/10 
                           transition"
              >
                {copiedId === prompt.id ? <Check size={18} /> : <Copy size={18} />}
              </button>

              {/* Favorite */}
              <button
                onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
                className={`w-10 h-10 flex items-center justify-center 
                            rounded-xl 
                            transition 
                            ${isFavorite 
                              ? 'bg-red-500/20 text-red-500' 
                              : 'bg-white/5 hover:bg-white/10'}`}
              >
                <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
              </button>
            </div>
          </div>

          {/* Кнопка повторить — теперь не перекрывается */}
          <button
            onClick={() => {
              setGeneratePrompt(prompt.prompt);
              setIsGenerateOpen(true);
            }}
            className="w-full
                       py-4
                       rounded-2xl
                       bg-gradient-to-b from-white to-zinc-200
                       text-black
                       font-semibold
                       shadow-lg shadow-white/10
                       hover:shadow-white/20
                       hover:-translate-y-0.5
                       active:translate-y-0
                       transition-all duration-300 ease-out">
            Повторить генерацию
          </button>

        </div>
      </div>

      {/* Модалка генерации */}
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
          referenceImage={referenceImage}
          handleFileChange={handleFileChange}
          handleRemoveImage={handleRemoveImage}
        />
      )}
    </div>
  );
}