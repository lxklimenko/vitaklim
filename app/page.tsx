'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase'; 
import { Toaster, toast } from 'sonner';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { HistorySection } from './components/HistorySection';
import { MainFeed } from './components/MainFeed';
import { CATEGORIES, PROMPTS } from './constants/appConstants';
import { useAuth } from './hooks/useAuth';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useAppActions } from './hooks/useAppActions';
import type { Generation } from './types';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

// Загружаем модалки только когда они нужны (Lazy Loading)
const ProfileModal = dynamic(() => import('./components/ProfileModal').then(mod => mod.ProfileModal), {
  ssr: false,
});

const GenerateModal = dynamic(() => import('./components/GenerateModal').then(mod => mod.GenerateModal), {
  ssr: false,
});

const PromptDetailModal = dynamic(() => import('./components/PromptDetailModal').then(mod => mod.PromptDetailModal), {
  ssr: false,
});

export default function App() {
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

  const hasLoadedGenerationsRef = useRef(false);

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
      hasLoadedGenerationsRef.current = false;
    }
  });

  // --- 3. UI STATE ---
  const [activeCategory, setActiveCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<any | null>(null);
  
  // Navigation State
  const [isFavoritesView, setIsFavoritesView] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Modals State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // --- 4. ACTIONS HOOK ---
  const {
    handleDownload,
    handleDownloadOriginal,
    handleDeleteGeneration,
    handleShare,
    toggleGenerationFavorite,
    toggleFavorite,
    handleCopy
  } = useAppActions(user, setGenerations, setFavorites, fetchProfile, setIsProfileOpen);

  // Дебаунс поиска
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Загрузка истории генераций
  useEffect(() => {
    if (user && isHistoryOpen) {
      if (!hasLoadedGenerationsRef.current) {
        fetchGenerations(user.id);
        hasLoadedGenerationsRef.current = true;
      }
    }
    
    if (!user || !isHistoryOpen) {
      hasLoadedGenerationsRef.current = false;
    }
  }, [user, isHistoryOpen, fetchGenerations]);

  // Сброс счетчика при изменении фильтров
  useEffect(() => {
    setVisibleCount(6);
  }, [activeCategory, isFavoritesView, debouncedSearch]);

  // Блокировка скролла при открытой модалке
  useEffect(() => {
    if (selectedPrompt) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.paddingRight = scrollBarWidth > 0 ? `${scrollBarWidth}px` : "";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.paddingRight = "";
    };
  }, [selectedPrompt]);

  // Авторизация
  const handleAuth = async () => {
    if (!email.includes('@')) return toast.error("Введите корректный email");
    if (password.length < 6) return toast.error("Пароль должен быть не менее 6 символов");
    
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением");
        setIsProfileOpen(false);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Аккаунт создан! Проверьте почту для подтверждения.");
        setAuthMode('login');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Пополнение баланса
  const handleTopUp = async (amount: number) => {
    if (!user) return setIsProfileOpen(true);
    setIsTopUpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { amount }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Ссылка на оплату не получена");
      }
    } catch (err: any) {
      console.error("Ошибка вызова функции:", err);
      toast.error("Ошибка платежа: " + (err.message || "Неизвестная ошибка"));
    } finally {
      setIsTopUpLoading(false);
    }
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
    setIsFavoritesView(false);
    setIsHistoryOpen(false);
  };

  // Фильтрация промптов
  const filteredPrompts = useMemo(() => {
    return PROMPTS.filter((p) => {
      const matchesCategory = activeCategory === "Все" || p.category === activeCategory;
      const matchesFavorites = !isFavoritesView || favorites.includes(p.id);
      const matchesSearch = p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                            p.tool.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesFavorites && matchesSearch;
    });
  }, [activeCategory, isFavoritesView, favorites, debouncedSearch]);

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
        onOpenProfile={() => setIsProfileOpen(true)}
        onResetView={() => {
          setIsFavoritesView(false);
          setIsProfileOpen(false);
          setIsHistoryOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <main className="pb-28 pt-8">
        {isHistoryOpen ? (
          <HistorySection
            user={user}
            generations={generations}
            onOpenProfile={() => setIsProfileOpen(true)}
            onSelectPrompt={setSelectedPrompt}
            onDeleteGeneration={handleDeleteGeneration}
            onRepeatGeneration={handleRepeatGeneration}
            onShare={handleShare}
            onDownloadOriginal={handleDownloadOriginal}
          />
        ) : (
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
            setSelectedPrompt={setSelectedPrompt}
            copiedId={copiedId}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        )}
      </main>

      {/* Navigation компонент */}
      <Navigation
        isFavoritesView={isFavoritesView}
        setIsFavoritesView={setIsFavoritesView}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        isHistoryOpen={isHistoryOpen}
        setIsHistoryOpen={setIsHistoryOpen}
        onOpenGenerator={() => setIsGenerateOpen(true)}
      />

      {/* МОДАЛКИ */}
      {isProfileOpen && (
        <ProfileModal
          user={user}
          balance={balance}
          purchases={purchases}
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          handleTopUp={handleTopUp}
          isTopUpLoading={isTopUpLoading}
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          authMode={authMode}
          setAuthMode={setAuthMode}
          handleAuth={handleAuth}
        />
      )}

      {selectedPrompt && (
        <PromptDetailModal
          selectedPrompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          favorites={favorites}
          toggleFavorite={toggleFavoriteWrapper}
          toggleGenerationFavorite={toggleGenerationFavorite}
          generations={generations}
          handleCopy={handleCopyWrapper}
          handleDownload={handleDownload}
          handleDownloadOriginal={handleDownloadOriginal}
          copiedId={copiedId}
          setIsGenerateOpen={setIsGenerateOpen}
          setGeneratePrompt={setGeneratePrompt}
        />
      )}

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