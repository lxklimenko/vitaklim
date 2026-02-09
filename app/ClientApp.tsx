'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { MainFeed } from './components/MainFeed';
import { CATEGORIES } from './constants/appConstants';
import { useAuth } from './hooks/useAuth';
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

  // AUTH
  const {
    user,
    favorites,
    setFavorites,
    setGenerations,
    fetchProfile,
    isLoading: isAuthLoading,
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
  } = useImageGeneration(user, () => {});

  // UI STATE
  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // DEBOUNCE SEARCH
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // FILTER PROMPTS
  const filteredPrompts = useMemo(() => {
    return prompts.filter(p => {
      const byCategory = activeCategory === 'Все' || p.category === activeCategory;
      const bySearch =
        p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.tool.toLowerCase().includes(debouncedSearch.toLowerCase());
      return byCategory && bySearch;
    });
  }, [activeCategory, debouncedSearch, prompts]);

  return (
    <div
      className={`${inter.className} min-h-screen bg-black text-white antialiased overflow-x-hidden`}
    >
      <Toaster position="bottom-center" theme="dark" />

      <Header
        user={user}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        onOpenProfile={() => router.push('/profile')}
        onResetView={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <main className="pb-28 pt-8">
        <MainFeed
          isLoading={isAuthLoading && filteredPrompts.length === 0}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          filteredPrompts={filteredPrompts}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          favorites={favorites}
          toggleFavorite={(e, id) => toggleFavorite(e, id, favorites)}
          handleCopy={(id, text, price) =>
            handleCopy(id, text, price, setCopiedId)
          }
          copiedId={copiedId}
          searchQuery={searchQuery}
          isSearchActive={isSearchActive}
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
