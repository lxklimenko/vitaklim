'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ChevronLeft, Share2, Copy, Check, Download, Heart } from 'lucide-react';
import { PROMPTS } from '../../constants/appConstants'; // Убедитесь, что путь правильный
import { useAuth } from '../../hooks/useAuth';
import { useAppActions } from '../../hooks/useAppActions';

export default function PromptPage() {
  const params = useParams();
  const { id } = params;

  // Ищем промпт в константах
  const prompt = PROMPTS.find((p) => p.id.toString() === id);

  const { user, favorites, setFavorites, setGenerations, fetchProfile } = useAuth();
  
  // Заглушка для модалки профиля, пока не вынесем ее глобально
  const setIsProfileOpen = (val: boolean) => console.log("Нужен логин"); 

  const actions = useAppActions(
    user, 
    setGenerations, 
    setFavorites, 
    fetchProfile, 
    setIsProfileOpen
  );

  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Добавляем проверку !prompt.image
  if (!prompt || !prompt.image) {
    return notFound();
  }

  const isFavorite = favorites.includes(prompt.id);

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <Link 
          href="/" 
          className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        
        <div className="pointer-events-auto flex gap-2">
           <button
             onClick={(e) => actions.toggleFavorite(e, prompt.id, favorites)}
             className={`w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md border border-white/10 transition-colors ${
               isFavorite ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-black/40 text-white'
             }`}
           >
             <Heart size={20} className={isFavorite ? "fill-current" : ""} />
           </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto md:pt-10 md:px-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="w-full md:w-1/2 aspect-[3/4] md:aspect-square relative bg-[#1c1c1e] md:rounded-3xl overflow-hidden">
             <Image
                src={prompt.image.src}
                alt={prompt.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
             />
          </div>

          <div className="flex-1 px-5 md:px-0 space-y-6 pt-4 md:pt-0">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10 border border-white/5 text-white/80">
                  {prompt.tool}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10 border border-white/5 text-white/80">
                  {prompt.category}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{prompt.title}</h1>
            </div>

            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5">
              <h3 className="text-sm font-medium text-white/40 mb-2 uppercase tracking-wider">Prompt</h3>
              <p className="font-mono text-sm leading-relaxed text-white/90 select-all whitespace-pre-wrap">
                {prompt.prompt}
              </p>
            </div>
            
            {prompt.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/40">Описание</h3>
                <p className="text-sm text-white/70 leading-relaxed">{prompt.description}</p>
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10 md:static md:bg-transparent md:border-none md:p-0 md:backdrop-blur-none z-50">
              <div className="flex gap-3 max-w-4xl mx-auto">
                <button
                  onClick={() => actions.handleCopy(prompt.id, prompt.prompt, prompt.price, setCopiedId)}
                  className="flex-1 h-12 rounded-xl bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {copiedId === prompt.id ? <Check size={18} /> : <Copy size={18} />}
                  {copiedId === prompt.id ? "Скопировано" : (prompt.price > 0 ? `Купить ${prompt.price}₽` : "Копировать")}
                </button>
                
                <button 
                  onClick={() => actions.handleDownload(prompt.image?.src || "")}
                  className="w-12 h-12 rounded-xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
                >
                  <Download size={20} />
                </button>
                
                <button 
                   onClick={() => actions.handleShare(`${window.location.origin}/prompt/${prompt.id}`)}
                   className="w-12 h-12 rounded-xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
                >
                  <Share2 size={20} />
                </button>
              </div>
            </div>
            <div className="h-20 md:hidden"></div>
          </div>
        </div>
      </div>
    </div>
  );
}