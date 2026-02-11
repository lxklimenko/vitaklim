'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound, useParams } from 'next/navigation';
import { ChevronLeft, Share2, Copy, Check, Download, Heart, Loader2 } from 'lucide-react';
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
  const id = params.id as string;

  // 1. Ищем в статичных промптах
  const staticPrompt = prompts.find(p => p.id.toString() === id);

  // 2. Стейт для данных из базы (если история)
  const [dbPrompt, setDbPrompt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!staticPrompt);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Стейт для открытия модалки генерации
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!prompt || !prompt.image) {
    return notFound();
  }

  const isFavorite = favorites.includes(prompt.id);

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* HERO */}
      <div className="relative w-full h-[85vh] bg-black">
        <Image
          src={prompt.image.src}
          alt={prompt.title}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />

        {/* Верхний overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
          <Link
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur"
          >
            <ChevronLeft size={22} />
          </Link>

          <button
            onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
            className={`w-10 h-10 flex items-center justify-center rounded-full backdrop-blur ${
              isFavorite ? 'bg-red-500/20 text-red-500' : 'bg-black/40'
            }`}
          >
            <Heart size={20} className={isFavorite ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Нижний икон-бар */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3 bg-black/40 backdrop-blur px-4 py-2 rounded-full">
          <button className="w-10 h-10 flex items-center justify-center">
            <Download size={20} />
          </button>
          <button className="w-10 h-10 flex items-center justify-center">
            <Copy size={20} />
          </button>
          <button className="w-10 h-10 flex items-center justify-center">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="max-w-4xl mx-auto px-6 -mt-6 relative z-10">
        <div className="flex items-center justify-between bg-[#0f0f10] border border-white/10 rounded-2xl px-4 py-3 shadow-lg">
          {/* Левая часть */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setGeneratePrompt(prompt.prompt);
                setIsGenerateOpen(true);
              }}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-white text-black hover:opacity-90 active:scale-95 transition"
              title="Повторить генерацию"
            >
              <Loader2 size={18} />
            </button>

            <button
              onClick={() => actions.handleCopy(prompt.id, prompt.prompt, 0, setCopiedId)}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
              title="Скопировать prompt"
            >
              {copiedId === prompt.id ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          {/* Правая часть (пока пустая — задел под будущее) */}
          <div className="text-xs text-white/40">
            {/* здесь будут ❤️ ⬇️ 🔗 🧠 */}
          </div>
        </div>
      </div>

      {/* НИЖНЯЯ ЧАСТЬ (пока минимально) */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <pre className="bg-[#1c1c1e] rounded-xl p-4 text-sm whitespace-pre-wrap text-white/80">
          {prompt.prompt}
        </pre>
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