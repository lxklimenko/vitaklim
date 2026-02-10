'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, ChevronLeft } from 'lucide-react';
import { Toaster } from 'sonner';
import { Navigation } from '../components/Navigation';
import { useAuth } from '../hooks/useAuth';
import { useAppActions } from '../hooks/useAppActions';
import { useImageGeneration } from '../hooks/useImageGeneration';

import dynamic from 'next/dynamic';
const GenerateModal = dynamic(() => import('../components/GenerateModal').then(m => m.GenerateModal), { ssr: false });

export default function HistoryPage() {
  const { 
  user,
  authReady,
  generations,
  generationsLoading,
  setGenerations,
  fetchGenerations,
  fetchProfile,
  balance,
  purchases
} = useAuth();

  
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const actions = useAppActions(
  user,
  setGenerations,
  () => {},
  fetchProfile,
  () => {}
);

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

  useEffect(() => {
    if (user) {
      fetchGenerations(user.id);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <Toaster theme="dark" position="top-center" />

      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">История генераций</h1>
      </header>

      <div className="px-4 py-6">
        {!authReady || generationsLoading ? (

          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : !user ? (
          <div className="text-center py-20 text-white/50">
            Войдите, чтобы видеть историю
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            Вы пока ничего не сгенерировали
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {generations.map((gen) => (
              <Link 
                key={gen.id}
                href={`/prompt/${gen.id}`}
                className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 group"
              >
                <Image 
                  src={gen.image_url} 
                  alt={gen.prompt} 
                  fill 
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    actions.handleDeleteGeneration(e, gen.id);
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur text-white/70 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>

      

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

      <Navigation onOpenGenerator={() => setIsGenerateOpen(true)} />
    </div>

  );
}