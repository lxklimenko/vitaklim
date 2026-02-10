import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { MODELS } from '../constants/appConstants';

export function useImageGeneration(user: any, onGenerationComplete: () => void) {
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState("auto");
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
      toast.error("Войдите в аккаунт для генерации");
      return;
    }
    if (!generatePrompt.trim()) return;

    setIsGenerating(true);
    try {
      // 1. Получаем временную ссылку от ИИ
      const res = await fetch("/api/generate-google/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: generatePrompt,
          modelId,
          aspectRatio: aspectRatio === "auto" ? "1:1" : aspectRatio,
          image: referenceImage 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка API");

      const temporaryUrl = data.imageUrl;

      // 2. СКАЧИВАЕМ КАРТИНКУ (превращаем ссылку в файл)
      const imageRes = await fetch(temporaryUrl);
      const blob = await imageRes.blob();
      
      // Создаем уникальное имя файла
      const fileName = `${user.id}/${Date.now()}.png`;

      // 3. ЗАГРУЖАЕМ В СВОЙ STORAGE (бакет 'generations')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generations')
        .upload(fileName, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      // Получаем постоянную публичную ссылку
      const { data: { publicUrl } } = supabase.storage
        .from('generations')
        .getPublicUrl(fileName);

      // 4. СОХРАНЯЕМ В ТАБЛИЦУ ГЕНЕРАЦИЙ
      const { error: dbError } = await supabase.from('generations').insert({
        user_id: user.id,
        prompt: generatePrompt,
        image_url: publicUrl, // Теперь тут ссылка на ТВОЙ Supabase
        is_favorite: false
      });

      if (dbError) throw dbError;

      // Устанавливаем URL для отображения
      setImageUrl(publicUrl);
      toast.success("Изображение сохранено навсегда!");
      onGenerationComplete(); // Обновляем список в истории

    } catch (error: any) {
      console.error("Критическая ошибка:", error);
      toast.error(error.message || "Ошибка соединения");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePrompt, setGeneratePrompt,
    isGenerating,
    imageUrl, setImageUrl,
    modelId, setModelId,
    aspectRatio, setAspectRatio,
    referenceImage, setReferenceImage,
    handleFileChange, handleRemoveImage, handleGenerate
  };
}