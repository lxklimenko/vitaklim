'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase-client'

export default function AddPromptPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    tool: 'Nano Banana Pro',
    category: 'Fashion',
    price: '0',
    prompt_text: '',
    description: '',
    best_for: '',
    aspect_ratio: '9:16',
  })

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.prompt_text || !imageFile) {
      alert('Заполните название, промпт и загрузите картинку')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      // 1. Загружаем картинку в Storage
      const ext = imageFile.name.split('.').pop()
      const fileName = `prompt_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('prompts-images')
        .upload(fileName, imageFile, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Получаем публичный URL
      const { data: urlData } = supabase.storage
        .from('prompts-images')
        .getPublicUrl(fileName)

      const imageUrl = urlData.publicUrl

      // 3. Получаем размеры картинки
      const img = new Image()
      img.src = preview!
      await new Promise(resolve => { img.onload = resolve })

      // 4. Сохраняем промпт в БД
      const { error: insertError } = await supabase
        .from('prompts')
        .insert({
          title: form.title,
          tool: form.tool,
          category: form.category,
          price: parseInt(form.price) || 0,
          prompt_text: form.prompt_text,
          description: form.description,
          best_for: form.best_for,
          aspect_ratio: form.aspect_ratio,
          image_url: imageUrl,
          image_width: img.naturalWidth,
          image_height: img.naturalHeight,
        })

      if (insertError) throw insertError

      alert('Промпт добавлен!')
      router.push('/admin')
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">➕ Добавить промпт</h1>

      <div className="space-y-4">
        {/* Картинка */}
        <div>
          <label className="block text-white/60 text-sm mb-2">Картинка *</label>
          <input type="file" accept="image/*" onChange={handleImage}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
          {preview && <img src={preview} alt="preview" className="mt-3 w-40 rounded-xl" />}
        </div>

        {/* Название */}
        <div>
          <label className="block text-white/60 text-sm mb-2">Название *</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Промпт «Название»"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30" />
        </div>

        {/* Промпт */}
        <div>
          <label className="block text-white/60 text-sm mb-2">Текст промпта *</label>
          <textarea value={form.prompt_text} onChange={e => setForm({ ...form, prompt_text: e.target.value })}
            rows={6} placeholder="Введите промпт..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 resize-none" />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-white/60 text-sm mb-2">Описание</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Краткое описание карточки"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30" />
        </div>

        {/* Best for */}
        <div>
          <label className="block text-white/60 text-sm mb-2">Для чего</label>
          <input value={form.best_for} onChange={e => setForm({ ...form, best_for: e.target.value })}
            placeholder="Fashion / Instagram"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30" />
        </div>

        {/* Категория, инструмент, соотношение, цена */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Категория</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
              <option value="Fashion">Fashion</option>
              <option value="Lifestyle">Lifestyle</option>
              <option value="Art">Art</option>
              <option value="Product">Product</option>
              <option value="Interior">Interior</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-2">Формат</label>
            <select value={form.aspect_ratio} onChange={e => setForm({ ...form, aspect_ratio: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
              <option value="9:16">9:16 (Вертикальный)</option>
              <option value="1:1">1:1 (Квадрат)</option>
              <option value="3:4">3:4</option>
              <option value="4:5">4:5</option>
              <option value="16:9">16:9 (Горизонтальный)</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-2">Модель</label>
            <select value={form.tool} onChange={e => setForm({ ...form, tool: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
              <option value="Nano Banana Pro">Nano Banana Pro</option>
              <option value="Nano Banano 2">Nano Banano 2</option>
              <option value="Imagen 4 Ultra">Imagen 4 Ultra</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-2">Цена (бананов)</label>
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              min="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30" />
          </div>
        </div>

        {/* Кнопка */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-gray-200 transition disabled:opacity-50 mt-4">
          {loading ? 'Сохранение...' : '✅ Сохранить промпт'}
        </button>

        <button onClick={() => router.push('/admin')}
          className="w-full border border-white/10 text-white/60 rounded-xl py-3 hover:bg-white/5 transition">
          Отмена
        </button>
      </div>
    </div>
  )
}
