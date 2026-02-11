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

  // Стейт для активного таба
  const [activeTab, setActiveTab] = useState<'description' | 'prompt' | 'settings'>('description');

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

      {/* ACTION BAR — тёмная, без теней, в цвет фона */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        <div className="flex items-center justify-between 
          bg-[#0a0a0a] 
          border border-white/10 
          rounded-2xl 
          px-6 py-4 
          shadow-none">
          {/* Левая часть — только копирование */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
              title="Скопировать prompt"
            >
              {copiedId === prompt.id ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-2">
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

            {/* Инфо / настройки (быстрый переход к промпту) */}
            <button
              onClick={() => setActiveTab('prompt')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
              title="Показать prompt"
            >
              🧠
            </button>
          </div>
        </div>
      </div>

      {/* TABS — Apple Segmented Control */}
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <div className="inline-flex p-1 bg-white/5 rounded-full mb-6">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              activeTab === 'description'
                ? 'bg-white shadow-sm text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Описание
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              activeTab === 'prompt'
                ? 'bg-white shadow-sm text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Prompt
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              activeTab === 'settings'
                ? 'bg-white shadow-sm text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Настройки
          </button>
        </div>

        {/* Tab content */}
        <div className="bg-[#0a0a0a] 
          border border-white/10 
          rounded-2xl 
          p-6 
          text-sm 
          text-white/80 
          shadow-none">
          {activeTab === 'description' && (
            <div className="space-y-6">
              <p className="text-white/80">
                {prompt.description || 'Описание недоступно.'}
              </p>

              <div>
                <button
                  onClick={() => {
                    setGeneratePrompt(prompt.prompt);
                    setIsGenerateOpen(true);
                  }}
                  className="w-full md:w-auto
                             px-8 py-4
                             rounded-2xl
                             bg-gradient-to-b from-white to-zinc-200
                             text-black
                             font-semibold
                             shadow-lg shadow-white/10
                             hover:shadow-white/20
                             hover:-translate-y-0.5
                             active:translate-y-0
                             transition-all duration-300 ease-out"
                >
                  Повторить генерацию
                </button>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <pre className="whitespace-pre-wrap">{prompt.prompt}</pre>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-2 text-white/70">
              <div>Модель: {prompt.tool}</div>
              <div>Категория: {prompt.category}</div>
              {prompt.image?.aspect && <div>Соотношение: {prompt.image.aspect}</div>}
            </div>
          )}
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