'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Heart } from 'lucide-react';
import { Toaster } from 'sonner';

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
  const { user, favorites, setFavorites, setGenerations, fetchProfile, balance, purchases } = useAuth();

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const actions = useAppActions(user, setGenerations, setFavorites, fetchProfile, setIsProfileOpen);

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
    handleGenerate
  } = useImageGeneration(user, () => setIsGenerateOpen(false));

  const favoritePrompts = prompts.filter(p => favorites.includes(p.id));

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
        {favoritePrompts.length === 0 ? (
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
          balance={balance}
          purchases={purchases}
          email="" setEmail={()=>{}}
          password="" setPassword={()=>{}}
          authMode="login" setAuthMode={()=>{}}
          handleAuth={()=>{}}
          handleTopUp={()=>{}}
          isTopUpLoading={false}
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
