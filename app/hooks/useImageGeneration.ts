import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { MODELS } from '../constants/appConstants';

export function useImageGeneration(
  user: any,
  onGenerationComplete: () => void,
  refreshBalance?: (userId: string) => void
) {
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
    console.log("HANDLE GENERATE CALLED");
    if (!user) {
      toast.error('Войдите в аккаунт для генерации');
      return;
    }
    if (!generatePrompt.trim()) {
      toast.error('Введите промпт');
      return;
    }

    // Проверка баланса перед генерацией (если есть поле balance)
    if (user.balance !== undefined && user.balance <= 0) {
      toast.error('Недостаточно средств на балансе');
      return;
    }

    setIsGenerating(true);
    try {
      // Создаём FormData и добавляем поля
      const formData = new FormData();
      formData.append("prompt", generatePrompt);
      formData.append("modelId", modelId);
      formData.append("aspectRatio", aspectRatio === 'auto' ? '1:1' : aspectRatio);

      // Если есть референсное изображение (dataURL), конвертируем его в Blob и добавляем
      if (referenceImage) {
        const response = await fetch(referenceImage);
        const blob = await response.blob();
        formData.append("image", blob, "reference.jpg"); // имя файла опционально
      }

      // Отправляем запрос без ручного заголовка Content-Type (браузер сам проставит multipart/form-data)
      const res = await fetch('/api/generate-google', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка API');

      setImageUrl(data.imageUrl);
      toast.success('Изображение сгенерировано');

      // Сохраняем в Supabase
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

      if (user && refreshBalance) {
        await refreshBalance(user.id);
      }

      onGenerationComplete();
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