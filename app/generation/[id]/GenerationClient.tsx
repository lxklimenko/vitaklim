'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X, Copy, Check, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  imageUrl: string;
  prompt: string | null;
  isOwner: boolean;
  authorName: string | null;
  authorAvatar: string | null;
  authorId: string;
}

export default function GenerationClient({ imageUrl, prompt, isOwner, authorName, authorAvatar, authorId }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'generated-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">

      {/* Кнопка назад */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 transition-all duration-200"
        >
          <X size={20} />
        </button>
      </div>

      {/* Картинка */}
      <div className="relative w-full bg-[#0a0a0a] flex justify-center">
        <div className="w-full relative">
          <Image
            src={imageUrl}
            alt="Generated image"
            width={1600}
            height={1200}
            className="w-full h-auto"
            priority
          />
          <div className="absolute bottom-6 left-6">
            <button
              onClick={handleDownload}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 transition-all duration-200"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Автор */}
      <div className="max-w-4xl mx-auto px-6 mt-6">
        <Link
          href={`/user/${authorId}`}
          className="flex items-center gap-3 p-4 bg-white/[0.04] border border-white/[0.07] rounded-2xl hover:bg-white/[0.07] transition"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center font-bold">
            {authorAvatar ? (
              <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{(authorName || 'A')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-[13px] font-medium text-white">
              {authorName || 'Аноним'}
            </p>
            <p className="text-[11px] text-white/40">
              {isOwner ? 'Вы • Автор' : 'Автор'}
            </p>
          </div>
        </Link>
      </div>

      {/* Промпт */}
      {prompt && (
        <div className="max-w-4xl mx-auto px-6 mt-4">
          <div className="bg-linear-to-b from-[#141414] to-[#0f0f0f] border border-white/10 rounded-3xl p-6 space-y-6 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="text-white/40 text-xs tracking-widest uppercase">История генерации</div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
            </div>
            <div className="flex gap-4">
              <div className="relative flex-1 h-44">
                <div className="overflow-y-auto hide-scrollbar pr-2 pb-4 text-white/90 text-sm leading-relaxed whitespace-pre-wrap h-full">
                  {prompt}
                </div>
                <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-linear-to-t from-[#141414] to-transparent" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-[#0f0f0f] to-transparent" />
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCopy}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}