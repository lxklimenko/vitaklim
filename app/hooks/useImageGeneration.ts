import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { MODELS } from '../constants/appConstants';

export function useImageGeneration(user: any, onGenerationComplete: () => void) {
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReferenceImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => setReferenceImage(null);

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Войдите в аккаунт для генерации');
      return;
    }
    if (!generatePrompt.trim()) return;

    setIsGenerating(true);
    try {
      // 1. Получаем временную ссылку от ИИ
      const res = await fetch('/api/generate-google/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generatePrompt,
          modelId,
          aspectRatio: aspectRatio === 'auto' ? '1:1' : aspectRatio,
          image: referenceImage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка API');

      // Устанавливаем URL для отображения
      setImageUrl(data.imageUrl);
      toast.success('Изображение сгенерировано');
      onGenerationComplete(); // Обновляем список в истории (если требуется)
    } catch (error: any) {
      console.error('Критическая ошибка:', error);
      toast.error(error.message || 'Ошибка соединения');
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePrompt,
    setGeneratePrompt,
    isGenerating,
    imageUrl,
    setImageUrl,
    modelId,
    setModelId,
    aspectRatio,
    setAspectRatio,
    referenceImage,
    setReferenceImage,
    handleFileChange,
    handleRemoveImage,
    handleGenerate,
  };
}