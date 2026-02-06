import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
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
    if (!generatePrompt.trim()) return;
    setIsGenerating(true);
    setImageUrl(null);

    try {
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
      
      if (res.ok) {
        setImageUrl(data.imageUrl);
        toast.success("Изображение сгенерировано!");
        if (user) {
          const { error } = await supabase.from('generations').insert({
            user_id: user.id,
            prompt: generatePrompt,
            image_url: data.imageUrl,
            is_favorite: false
          });
          if (!error) onGenerationComplete(); // Обновляем историю в useAuth
        }
      } else {
        toast.error(data.error || "Ошибка генерации");
      }
    } catch (error) {
      console.error("Ошибка при генерации:", error);
      toast.error("Ошибка соединения с сервером");
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