'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound, useParams } from 'next/navigation';
import { ChevronLeft, Share2, Copy, Check, Download, Heart, Loader2, X } from 'lucide-react';
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

  // Вкладки больше не переключаются — всегда показываем описание
  const activeTab = 'description';

  const { user, favorites, setFavorites, setGenerations, fetchProfile } = useAuth();
  const setIsProfileOpen = () => {};

  const actions = useAppActions(user, setGenerations, setFavorites, fetchProfile, setIsProfileOpen);

  // Хук генерации — точно такой же, как в ClientApp
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
  } = useImageGeneration(user, () => {});

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

  // ----- Функция скачивания изображения -----
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = prompt.image.src;
    link.download = `prompt-${prompt.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const isFavorite = favorites.includes(prompt.id);

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

      {/* ACTION BAR — тёмная, без теней, все кнопки справа */}
      <div className="max-w-4xl mx-auto px-6 mt-3">
        <div className="flex items-center justify-end 
          bg-[#0a0a0a] 
          border border-white/10 
          rounded-2xl 
          px-6 py-1,5 
          shadow-none">
          {/* Единая группа кнопок справа */}
          <div className="flex items-center gap-2">
            {/* Copy */}
            <button
              onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
              title="Скопировать prompt"
            >
              {copiedId === prompt.id ? <Check size={18} /> : <Copy size={18} />}
            </button>

            {/* Избранное */}
            <button
              onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition active:scale-95 ${
                isFavorite
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
              title="В избранное"
            >
              <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
            </button>

            {/* Скачать */}
            <button
              onClick={handleDownload}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
              title="Скачать изображение"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Блок с описанием — теперь показывает prompt */}
      <div className="max-w-4xl mx-auto px-6 mt-6">
        <div className="bg-[#111111] 
                      border border-white/10 
                      rounded-3xl 
                      p-6 
                      space-y-6">
          {/* Заголовок */}
          <div className="text-white/50 text-xs uppercase tracking-wider">
            Prompt
          </div>

          {/* Текст промпта */}
          <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
            {prompt.prompt}
          </div>

          {/* Кнопка */}
          <button
            onClick={() => {
              setGeneratePrompt(prompt.prompt);
              setIsGenerateOpen(true);
            }}
            className="w-full 
                       py-4 
                       rounded-2xl 
                       bg-white 
                       text-black 
                       font-medium 
                       hover:opacity-90 
                       active:scale-95 
                       transition-all duration-200">
            Повторить генерацию
          </button>
        </div>
      </div>

      {/* Модалка генерации — все пропсы из useImageGeneration */}
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