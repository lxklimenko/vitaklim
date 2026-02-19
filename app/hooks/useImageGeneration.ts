import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { MODELS } from '../constants/appConstants';

// Типизация пользователя (можно расширить или вынести в отдельный тип)
interface User {
  id: string;
  balance?: number;
}

export function useImageGeneration(
  user: User | null,
  onGenerationComplete: () => void,
  refreshBalance?: (userId: string) => Promise<void>
) {
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);

  // Обработка выбора файла
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация размера (макс. 5 МБ)
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      toast.error('Файл слишком большой. Максимальный размер — 5 МБ');
      e.target.value = ''; // сбросить инпут
      return;
    }

    // Валидация типа (только изображения)
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения');
      e.target.value = '';
      return;
    }

    // Создаём preview-ссылку
    const previewUrl = URL.createObjectURL(file);
    setReferencePreview(previewUrl);
    setReferenceImage(file);
  }, []);

  // Удаление референсного изображения
  const handleRemoveImage = useCallback(() => {
    if (referencePreview) {
      URL.revokeObjectURL(referencePreview); // освобождаем память
    }
    setReferencePreview(null);
    setReferenceImage(null);
  }, [referencePreview]);

  // Основная генерация
  const handleGenerate = useCallback(async () => {
    console.log('HANDLE GENERATE CALLED');
    if (!user) {
      toast.error('Войдите в аккаунт для генерации');
      return;
    }
    if (!generatePrompt.trim()) {
      toast.error('Введите промпт');
      return;
    }
    if (user.balance !== undefined && user.balance <= 0) {
      toast.error('Недостаточно средств на балансе');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('prompt', generatePrompt);
      formData.append('modelId', modelId);
      formData.append('aspectRatio', aspectRatio === 'auto' ? '1:1' : aspectRatio);

      // Добавляем файл, если он есть (теперь это File, не DataURL)
      if (referenceImage) {
        formData.append('image', referenceImage, referenceImage.name);
      }

      const res = await fetch('/api/generate-google', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка API');

      setImageUrl(data.imageUrl);
      toast.success('Изображение сгенерировано');

      // Сохраняем в историю
      if (user) {
        const { error } = await supabase.from('generations').insert({
          user_id: user.id,
          prompt: generatePrompt,
          image_url: data.imageUrl,
          model_id: modelId,
          aspect_ratio: aspectRatio === 'auto' ? '1:1' : aspectRatio,
          created_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Ошибка сохранения в историю:', error);
        }
      }

      // Обновляем баланс, если передана функция
      if (refreshBalance) {
        await refreshBalance(user.id).catch(console.error);
      }

      onGenerationComplete();
    } catch (error: any) {
      console.error('Критическая ошибка:', error);
      toast.error(error.message || 'Ошибка соединения');
    } finally {
      setIsGenerating(false);
    }
  }, [
    user,
    generatePrompt,
    modelId,
    aspectRatio,
    referenceImage,
    refreshBalance,
    onGenerationComplete,
  ]);

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
    referencePreview,        // для отображения превью
    referenceImage,          // сам файл (если нужно)
    handleFileChange,
    handleRemoveImage,
    handleGenerate,
  };
}