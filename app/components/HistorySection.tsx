'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, ImageIcon, Trash2, Calendar, Copy, Zap, Share2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface HistorySectionProps {
  user: any;
  generations: any[];
  onOpenProfile: () => void;
  onDeleteGeneration: (e: React.MouseEvent, id: string) => void;
  onRepeatGeneration: (prompt: string) => void;
  onShare: (url: string) => void;
  onDownloadOriginal: (url: string, filename: string) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  user,
  generations,
  onOpenProfile,
  onDeleteGeneration,
  onRepeatGeneration,
  onShare,
  onDownloadOriginal
}) => {
  return (
    <div className="px-4">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">История генераций</h2>
        <p className="text-sm text-white/40">Ваши созданные изображения</p>
      </div>
      
      {!user ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
            <Clock size={24} className="text-white/20" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-white/40 mb-2">Войдите в аккаунт</h3>
          <p className="text-xs text-white/20 mb-6">История доступна только авторизованным пользователям</p>
          <button 
            onClick={onOpenProfile}
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm active:scale-95 transition"
          >
            Войти
          </button>
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
            <ImageIcon size={24} className="text-white/20" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-white/40 mb-2">Пока пусто</h3>
          <p className="text-xs text-white/20">Создайте первое изображение в генераторе</p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 gap-4"
        >
          {generations.map((generation) => (
            <Link 
              key={generation.id} 
              href={`/prompt/${generation.id}`}
              className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.03] overflow-hidden relative group cursor-pointer block"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDeleteGeneration(e, generation.id);
                }}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-red-500/80 text-white/60 hover:text-white transition-all"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="aspect-square bg-black/40 relative overflow-hidden">
                <Image 
                  src={generation.image_url} 
                  alt="Generated"
                  fill
                  sizes="(max-width: 768px) 50vw, 300px"
                  className="object-cover transition-opacity duration-300"
                />
              </div>
              
              <div className="p-4 space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 h-24 overflow-y-auto">
                  <p className="text-xs leading-relaxed text-white/90 whitespace-pre-wrap font-medium">
                    {generation.prompt}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-xs text-white/30">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{new Date(generation.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    e.preventDefault();
                    navigator.clipboard.writeText(generation.prompt); 
                    toast.success("Промпт скопирован!"); 
                  }}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                >
                  <Copy size={14} />
                </button>
                
                <Link
                  href={`/generator?prompt=${encodeURIComponent(generation.prompt)}`}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Zap size={14} />
                </Link>
                
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    e.preventDefault();
                    onShare(generation.image_url); 
                  }}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                >
                  <Share2 size={14} />
                </button>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDownloadOriginal(generation.image_url, `vision-${generation.id}.png`);
                  }}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                >
                  <Upload size={14} />
                </button>
              </div>
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
};