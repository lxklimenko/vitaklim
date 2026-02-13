'use client';
import { useFilteredPrompts } from './hooks/useFilteredPrompts';
import dynamic from 'next/dynamic';
import React, { useState, useCallback, useDeferredValue } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { MainFeed } from './components/MainFeed';
import { useAuth } from '@/app/context/AuthContext';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useAppActions } from './hooks/useAppActions';
import type { Prompt } from './types/prompt';
import { useRouter } from 'next/navigation';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const GenerateModal = dynamic(
  () => import('./components/GenerateModal').then(m => m.GenerateModal),
  { ssr: false }
);

interface ClientAppProps {
  prompts: Prompt[];
}

export default function ClientApp({ prompts }: ClientAppProps) {
  const router = useRouter();

  // AUTH - ИСПРАВЛЕННЫЙ ВЫЗОВ useAuth
  const {
    user,
    authReady,
    favoritesLoading,
    generationsLoading,
    balance,
    favorites,
    purchases,
    generations,
    setFavorites,
    setGenerations,
    fetchProfile,
  } = useAuth();

  // GENERATION
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
  } = useImageGeneration(
    user,
    () => {},
    fetchProfile
  );

  // UI STATE
  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [visibleCount, setVisibleCount] = useState(6);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  // ACTIONS
  const { toggleFavorite, handleCopy } = useAppActions(
    user,
    setGenerations,
    setFavorites,
    fetchProfile,
    () => {}
  );
  
  const onToggleFavorite = useCallback(
    (e: React.MouseEvent, id: number) => {
      toggleFavorite(e, id, favorites);
    },
    [toggleFavorite, favorites]
  );

  const onHandleCopy = useCallback(
    (id: number, text: string, price: number) => {
      handleCopy(id, text, price, setCopiedId);
    },
    [handleCopy]
  );

  // ЛОКАЛЬНЫЙ INDIKATOR ЗАГРУЗКИ - вместо isAuthLoading
  const isLoading = favoritesLoading || generationsLoading;

  // FILTER PROMPTS
  const filteredPrompts = useFilteredPrompts({
    prompts,
    activeCategory,
    searchQuery,
  });

  return (
    <div
      className={`${inter.className} min-h-screen bg-black text-white antialiased overflow-x-hidden`}
    >
      <Toaster position="bottom-center" theme="dark" />

      <Header
        user={user}
        authReady={authReady}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        onOpenProfile={() => router.push('/profile')}
        onResetView={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <main className="pb-28 pt-8">
        <MainFeed
          // Используем локальный isLoading вместо isAuthLoading
          isLoading={isLoading && filteredPrompts.length === 0}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          filteredPrompts={filteredPrompts}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          favorites={favorites}
          toggleFavorite={onToggleFavorite}
          handleCopy={onHandleCopy}
          copiedId={copiedId}
          searchQuery={searchQuery}
          
        />
      </main>

      <Navigation onOpenGenerator={() => setIsGenerateOpen(true)} />

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