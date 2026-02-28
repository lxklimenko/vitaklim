import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { MODELS } from '../constants/appConstants';
import { useBalance } from '@/app/context/BalanceContext';

// Типизация пользователя (можно расширить или вынести в отдельный тип)
interface User {
  id: string;
  balance?: number;
}

export function useImageGeneration(
  user: User | null,
  onGenerationComplete: () => void
) {
  const { balance, setBalance } = useBalance();
  const router = useRouter();
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
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
    setReferenceFile(file);
  }, []);

  // Удаление референсного изображения
  const handleRemoveImage = useCallback(() => {
    if (referencePreview) {
      URL.revokeObjectURL(referencePreview); // освобождаем память
    }
    setReferencePreview(null);
    setReferenceFile(null);
  }, [referencePreview]);

  // Основная генерация
  const handleGenerate = useCallback(async () => {
    // Защита от двойного запуска
    if (isGenerating) return;

    // 1. Определяем стоимость генерации на основе выбранной модели
    const currentModel = MODELS.find(m => m.id === modelId);
    const cost = currentModel?.price || 1;

    console.log('HANDLE GENERATE CALLED', { 
      user: !!user, 
      prompt: generatePrompt, 
      balance, 
      modelId,
      cost
    });

    if (!user) {
      toast.error('Войдите в аккаунт для генерации');
      return;
    }
    if (!generatePrompt.trim()) {
      toast.error('Введите промпт');
      return;
    }
    // 2. Проверяем достаточно ли средств с учётом стоимости
    if (balance < cost) {
      toast.error(`Недостаточно средств. Для этой модели нужно ${cost} монет`);
      return;
    }

    // 3. Запрет на использование фото с моделью DALL-E 3
    if (modelId === 'dall-e-3' && referenceFile) {
      toast.error('Модель GPT Image не поддерживает генерацию по фото. Удалите фото, чтобы продолжить.');
      return;
    }

    // Сохраняем предыдущий баланс для возможного отката
    const previousBalance = balance;

    // 4. Оптимистичное списание (не 1, а реальная стоимость)
    setBalance(prev => Math.max(prev - cost, 0));

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('prompt', generatePrompt);
      formData.append('modelId', modelId);
      formData.append('aspectRatio', aspectRatio === 'auto' ? '1:1' : aspectRatio);

      // Добавляем файл, если он есть
      if (referenceFile) {
        formData.append('image', referenceFile, referenceFile.name);
      }

      const res = await fetch('/api/generate-google', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка API');

      toast.success('Изображение сгенерировано');

      if (data.generationId) {
        router.push(`/generation/${data.generationId}`);
      }
    } catch (error: any) {
      // Откатываем баланс в случае ошибки
      setBalance(previousBalance);
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
    referenceFile,
    balance,
    setBalance,
    router,
    isGenerating,
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
    referenceFile,
    referencePreview,
    handleFileChange,
    handleRemoveImage,
    handleGenerate,
  };
}