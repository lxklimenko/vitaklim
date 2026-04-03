'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X, Copy, Check, Download, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase-client';
import { useAuth } from '@/app/context/AuthContext';

interface Props {
  imageUrl: string;
  prompt: string | null;
  isOwner: boolean;
  authorName: string | null;
  authorAvatar: string | null;
  authorId: string;
}

interface Comment {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  profiles: {
    telegram_first_name: string | null;
    telegram_username: string | null;
    telegram_avatar_url: string | null;
  } | null;
}

export default function GenerationClient({ imageUrl, prompt, isOwner, authorName, authorAvatar, authorId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();

  // Получаем generation_id из URL
  const generationId = typeof window !== 'undefined' 
    ? window.location.pathname.split('/').pop() 
    : '';

  useEffect(() => {
    if (!generationId) return;
    fetchComments();
  }, [generationId])

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('id, text, created_at, user_id')
      .eq('generation_id', generationId)
      .order('created_at', { ascending: true })

    if (!data) return

    // Загружаем профили отдельно
    const userIds = [...new Set(data.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    setComments(data.map(c => ({
      ...c,
      profiles: profileMap[c.user_id] ?? null
    })))
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !generationId) return

    setIsSending(true)
    const { error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        generation_id: generationId,
        text: newComment.trim()
      })

    if (!error) {
      setNewComment('')
      await fetchComments()
    }
    setIsSending(false)
  }

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

      <div className="max-w-4xl mx-auto px-6 mt-6 space-y-4">

        {/* Автор */}
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
            <p className="text-[13px] font-medium">{authorName || 'Аноним'}</p>
            <p className="text-[11px] text-white/40">{isOwner ? 'Вы • Автор' : 'Автор'}</p>
          </div>
        </Link>

        {/* Промпт */}
        {prompt && (
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/30">Промпт</p>
              <button
                onClick={handleCopy}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-white/70 whitespace-pre-wrap">
              {prompt}
            </p>
          </div>
        )}

        {/* Комментарии */}
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/30 mb-4">
            Комментарии {comments.length > 0 && `· ${comments.length}`}
          </p>

          {/* Список комментариев */}
          {comments.length === 0 ? (
            <p className="text-[13px] text-white/25 text-center py-4">
              Будьте первым кто оставит комментарий
            </p>
          ) : (
            <div className="space-y-4 mb-4">
              {comments.map(comment => {
                const name = comment.profiles?.telegram_first_name || 
                            comment.profiles?.telegram_username || 
                            'Аноним'
                return (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                      {comment.profiles?.telegram_avatar_url ? (
                        <img src={comment.profiles.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/user/${comment.user_id}`} className="text-[12px] font-semibold hover:text-white/80 transition">
                          {name}
                        </Link>
                        <span className="text-[10px] text-white/25">
                          {new Date(comment.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[13px] text-white/70 mt-0.5 leading-relaxed">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Поле ввода */}
          {user ? (
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                placeholder="Написать комментарий..."
                className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition"
              />
              <button
                onClick={handleSendComment}
                disabled={!newComment.trim() || isSending}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-black disabled:opacity-40 transition active:scale-95"
              >
                <Send size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/profile"
              className="block text-center text-[13px] text-white/40 hover:text-white mt-4 pt-4 border-t border-white/5 transition"
            >
              Войдите чтобы оставить комментарий
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}