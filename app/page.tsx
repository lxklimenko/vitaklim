'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect } from 'react';
import { Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase'; 
import { Toaster, toast } from 'sonner';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { MainFeed } from './components/MainFeed';
import { CATEGORIES, PROMPTS } from './constants/appConstants';
import { useAuth } from './hooks/useAuth';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useAppActions } from './hooks/useAppActions';
import type { Generation } from './types';
import { useRouter } from 'next/navigation';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

// Загружаем модалки только когда они нужны (Lazy Loading)
const GenerateModal = dynamic(() => import('./components/GenerateModal').then(mod => mod.GenerateModal), {
  ssr: false,
});

export default function App() {
  const router = useRouter();
  
  // --- 1. DATA & AUTH ---
  const { 
    user, 
    balance, 
    favorites, 
    purchases, 
    generations, 
    setFavorites, 
    setGenerations,
    setPurchases,
    fetchProfile,
    fetchGenerations,
    isLoading: isAuthLoading 
  } = useAuth();

  // --- 2. GENERATION LOGIC ---
  const {
    generatePrompt, setGeneratePrompt,
    isGenerating,
    modelId, setModelId,
    aspectRatio, setAspectRatio,
    referenceImage,
    handleFileChange, handleRemoveImage, handleGenerate
  } = useImageGeneration(user, () => {
    if (user) {
      // Callback for when generation is complete
    }
  });

  // --- 3. UI STATE ---
  const [activeCategory, setActiveCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // Navigation State
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Modals State
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  // --- 4. ACTIONS HOOK ---
  const {
    handleDownload,
    handleDownloadOriginal,
    handleDeleteGeneration,
    handleShare,
    toggleGenerationFavorite,
    toggleFavorite,
    handleCopy
  } = useAppActions(user, setGenerations, setFavorites, fetchProfile, () => {}); // Добавлена заглушка

  // Дебаунс поиска
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Сброс счетчика при изменении фильтров
  useEffect(() => {
    setVisibleCount(6);
  }, [activeCategory, debouncedSearch]);

  // Переход на страницу профиля
  const handleOpenProfile = () => {
    router.push('/profile');
  };

  // Копирование промпта
  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Промпт скопирован!");
    } catch {
      toast.error("Ошибка при копировании");
    }
  };

  // Повтор генерации
  const handleRepeatGeneration = (prompt: string) => {
    setGeneratePrompt(prompt);
    setIsGenerateOpen(true);
  };

  // Смена категории
  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
  };

  // Фильтрация промптов
  const filteredPrompts = useMemo(() => {
    return PROMPTS.filter((p) => {
      const matchesCategory = activeCategory === "Все" || p.category === activeCategory;
      const matchesSearch = p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                          p.tool.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, favorites, debouncedSearch]);

  // Обертка для toggleFavorite с передачей favorites
  const toggleFavoriteWrapper = async (e: React.MouseEvent, promptId: number) => {
    return toggleFavorite(e, promptId, favorites);
  };

  // Обертка для handleCopy с передачей setCopiedId
  const handleCopyWrapper = async (id: number, text: string, price: number) => {
    return handleCopy(id, text, price, setCopiedId);
  };

  return (
    <div className={`${inter.className} min-h-screen bg-black text-white selection:bg-white/20 antialiased overflow-x-hidden`}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass { 
          background: rgba(255, 255, 255, 0.03); 
          backdrop-filter: blur(20px) saturate(180%); 
          -webkit-backdrop-filter: blur(20px) saturate(180%); 
        }
      `}</style>

      <Toaster position="bottom-center" theme="dark" />

      {/* Header компонент */}
      <Header
        user={user}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        onOpenProfile={handleOpenProfile}
        onResetView={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <main className="pb-28 pt-8">
        <MainFeed
          isLoading={isAuthLoading && filteredPrompts.length === 0}
          activeCategory={activeCategory}
          setActiveCategory={handleCategoryChange}
          filteredPrompts={filteredPrompts}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          favorites={favorites}
          toggleFavorite={toggleFavoriteWrapper}
          handleCopy={handleCopyWrapper}
          copiedId={copiedId}
          searchQuery={searchQuery}
          isSearchActive={isSearchActive}
        />
      </main>

      {/* Navigation компонент (BottomNav) */}
      <Navigation
  onOpenGenerator={() => setIsGenerateOpen(true)}
/>

      {/* МОДАЛКА ГЕНЕРАЦИИ */}
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