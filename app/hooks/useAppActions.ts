import { supabase } from '@/app/lib/supabase';
import { toast } from 'sonner';
import { Generation } from '../types'; // Убедитесь, что типы существуют

export const useAppActions = (
  user: any,
  setGenerations: React.Dispatch<React.SetStateAction<any[]>>,
  setFavorites: React.Dispatch<React.SetStateAction<number[]>>,
  fetchProfile: (id: string) => Promise<void>,
  setIsProfileOpen: (isOpen: boolean) => void
) => {

  // 1. Скачивание
  const handleDownload = (url: string, filename: string = 'vision-image.jpg') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Изображение сохранено!");
  };

  const handleDownloadOriginal = async (url: string, filename: string) => {
    try {
      toast.loading("Подготовка файла...");
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || `vision-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.dismiss();
      toast.success("Оригинал сохранен!");
    } catch (error) {
      toast.error("Ошибка при скачивании");
    }
  };

  // 2. Удаление генерации
  const handleDeleteGeneration = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const { error } = await supabase.from('generations').delete().eq('id', id);
      if (error) throw error;
      setGenerations(prev => prev.filter(gen => gen.id !== id));
      toast.success("Генерация удалена");
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error("Ошибка при удалении");
    }
  };

  // 3. Шаринг
  const handleShare = async (imageUrl: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "AI image", text: "Сгенерировал с помощью Vision", url: imageUrl });
        toast.success("Поделились!");
      } else {
        await navigator.clipboard.writeText(imageUrl);
        toast.success("Ссылка скопирована!");
      }
    } catch (error) {
      // Игнорируем AbortError (если пользователь закрыл окно шаринга)
    }
  };

  // 4. Избранное (Генерации)
  const toggleGenerationFavorite = async (generation: Generation) => {
    if (!user) return;
    try {
      const newStatus = !generation.is_favorite;
      setGenerations(prev => prev.map(gen => gen.id === generation.id ? { ...gen, is_favorite: newStatus } : gen));
      
      const { error } = await supabase.from('generations').update({ is_favorite: newStatus }).eq('id', generation.id);
      if (error) throw error; // Если ошибка, можно откатить состояние обратно, но для простоты оставим так
      toast.success(newStatus ? 'Добавлено в избранное' : 'Удалено из избранного');
    } catch (error) {
      toast.error('Ошибка при обновлении');
    }
  };

  // 5. Избранное (Промпты)
  const toggleFavorite = async (e: React.MouseEvent, promptId: number, favorites: number[]) => {
    e.stopPropagation();
    if (!user) return setIsProfileOpen(true);
    
    const isFav = favorites.includes(promptId);
    try {
      if (isFav) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('prompt_id', promptId);
        if (!error) setFavorites(prev => prev.filter(id => id !== promptId));
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, prompt_id: promptId });
        if (!error) setFavorites(prev => [...prev, promptId]);
      }
    } catch (err) { toast.error("Ошибка синхронизации"); }
  };

  // 6. Копирование и Покупка
  const handleCopy = async (id: number, text: string, price: number, setCopiedId: (id: number | null) => void) => {
    if (!user && price > 0) return setIsProfileOpen(true);

    if (price > 0) {
      const { data: canBuy } = await supabase.rpc('can_make_purchase');
      if (!canBuy) return toast.error("Слишком много операций, подожди минуту");

      const { error: spendError } = await supabase.rpc('spend_balance', { amount_to_spend: price });
      if (spendError) return toast.error("Недостаточно средств");
    }

    try {
      await navigator.clipboard.writeText(text);
      if (price > 0 && user) {
        await supabase.from('purchases').insert({ user_id: user.id, prompt_id: id, amount: price });
        await fetchProfile(user.id);
      }
      setCopiedId(id);
      toast.success("Скопировано!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Ошибка"); }
  };

  return {
    handleDownload,
    handleDownloadOriginal,
    handleDeleteGeneration,
    handleShare,
    toggleGenerationFavorite,
    toggleFavorite,
    handleCopy
  };
};