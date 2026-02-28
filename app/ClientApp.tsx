'use client';
import { useFilteredPrompts } from './hooks/useFilteredPrompts';
import { useTelegramInit } from './hooks/useTelegramInit';
import React, { useState, useCallback, useDeferredValue } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { MainFeed } from './components/MainFeed';
import { useAuth } from '@/app/context/AuthContext';
import { useAppActions } from './hooks/useAppActions';
import type { Prompt } from './types/prompt';
import { useRouter } from 'next/navigation';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

interface ClientAppProps {
  prompts: Prompt[];
}

export default function ClientApp({ prompts }: ClientAppProps) {
  const router = useRouter();

  // Telegram initialization
  useTelegramInit();

  // AUTH
  const {
    user,
    authReady,
    profileReady,
    favoritesLoading,
    favorites,
    setFavorites,
    fetchProfile,
    telegramUsername,
    telegramFirstName,
  } = useAuth();

  // UI STATE
  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [visibleCount, setVisibleCount] = useState(6);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // ACTIONS
  const { toggleFavorite, handleCopy } = useAppActions(
    user,
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

  // ЛОКАЛЬНЫЙ ИНДИКАТОР ЗАГРУЗКИ
  const isLoading = favoritesLoading;

  // FILTER PROMPTS (using deferred search for better performance)
  const filteredPrompts = useFilteredPrompts({
    prompts,
    activeCategory,
    searchQuery: deferredSearch,
  });

  return (
    <div className={`${inter.className} bg-black text-white antialiased overflow-x-hidden`}>
      <Toaster position="bottom-center" theme="dark" />

      <Header
        user={user}
        authReady={authReady}
        profileReady={profileReady}
        telegramUsername={telegramUsername}
        telegramFirstName={telegramFirstName}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        onOpenProfile={() => router.push('/profile')}
        onResetView={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <main className="pb-28 pt-2">
        <MainFeed
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

      <Navigation />
    </div>
  );
}