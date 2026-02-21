'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Heart } from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { Navigation } from '../components/Navigation';
import { PromptCard } from '../components/PromptCard';
import { Prompt } from '../types/prompt';
import { useAuth } from '../hooks/useAuth';
import { useAppActions } from '../hooks/useAppActions';
import { useImageGeneration } from '../hooks/useImageGeneration';

import dynamic from 'next/dynamic';
const GenerateModal = dynamic(() => import('../components/GenerateModal').then(m => m.GenerateModal), { ssr: false });
const ProfileModal = dynamic(() => import('../components/ProfileModal').then(m => m.ProfileModal), { ssr: false });

interface FavoritesClientProps {
  prompts: Prompt[];
}

export default function FavoritesClient({ prompts }: FavoritesClientProps) {
  const {
    user,
    authReady,
    favorites,
    favoritesLoading,
    purchases,
    setFavorites,
    fetchProfile,
  } = useAuth();

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  const actions = useAppActions(user, setFavorites, fetchProfile, setIsProfileOpen);

  const {
    generatePrompt,
    setGeneratePrompt,
    isGenerating,
    modelId,
    setModelId,
    aspectRatio,
    setAspectRatio,
    referencePreview,
    handleFileChange,
    handleRemoveImage,
    handleGenerate
  } = useImageGeneration(user, () => {});

  const favoritePrompts = prompts.filter(p => favorites.includes(p.id));

  const handleTopUp = async (amount: number) => {
    if (!user) {
      toast.error('Нужно войти в аккаунт');
      return;
    }

    try {
      setIsTopUpLoading(true);

      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          userId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Ошибка оплаты');
        return;
      }

      if (data.confirmationUrl) {
        if ((window as any).Telegram?.WebApp) {
          (window as any).Telegram.WebApp.openLink(data.confirmationUrl);
        } else {
          window.location.href = data.confirmationUrl;
        }
        return;
      }

      toast.error('Не удалось получить ссылку на оплату');
    } catch (error) {
      console.error(error);
      toast.error('Ошибка соединения');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <Toaster position="bottom-center" theme="dark" />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">Избранное</h1>
      </header>

      <div className="px-4 py-6">
        {!authReady || favoritesLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-3/4 rounded-2xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : favoritePrompts.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={32} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/50">В избранном пока пусто</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {favoritePrompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                favorites={favorites}
                toggleFavorite={(e, id) => actions.toggleFavorite(e, id, favorites)}
                handleCopy={(id, text, price) => actions.handleCopy(id, text, price, setCopiedId)}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}
      </div>

      <Navigation onOpenGenerator={() => setIsGenerateOpen(true)} />

      {isProfileOpen && (
        <ProfileModal
          user={user}
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          purchases={purchases}
          email=""
          setEmail={() => {}}
          password=""
          setPassword={() => {}}
          authMode="login"
          setAuthMode={() => {}}
          handleAuth={async (e) => { e.preventDefault() }}
          handleTopUp={handleTopUp}
          handleLogout={async () => {}}
          isTopUpLoading={isTopUpLoading}
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
          referencePreview={referencePreview}
          handleFileChange={handleFileChange}
          handleRemoveImage={handleRemoveImage}
        />
      )}
    </div>
  );
}