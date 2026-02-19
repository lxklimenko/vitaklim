'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronDown, 
  X, 
  Image as ImageIcon, 
  Check, 
  Loader2, 
  Sparkles 
} from 'lucide-react';
import { MODELS } from '@/app/constants/appConstants';

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatePrompt: string;
  setGeneratePrompt: (v: string) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  modelId: string;
  setModelId: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  referencePreview: string | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
}

export function GenerateModal({
  isOpen,
  onClose,
  generatePrompt,
  setGeneratePrompt,
  isGenerating,
  handleGenerate,
  modelId,
  setModelId,
  aspectRatio,
  setAspectRatio,
  referencePreview,
  handleFileChange,
  handleRemoveImage
}: GenerateModalProps) {
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);

  const currentModel = MODELS.find(m => m.id === modelId) || MODELS[0];
  const isPromptEmpty = !generatePrompt.trim();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#111]">
            <button 
              onClick={onClose}
              aria-label="Закрыть окно"
              className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="text-[15px] font-medium">Назад</span>
            </button>

            <div className="flex items-center gap-2 cursor-pointer">
              <span className="text-[15px] font-semibold">Картинка</span>
              <ChevronDown size={14} className="text-white/60" />
            </div>

            <button 
              onClick={onClose}
              aria-label="Закрыть"
              className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Модель */}
            <div className="space-y-2 relative z-50">
              <label className="text-[13px] font-medium text-white/60 ml-1">Модель</label>
              
              <div className="relative">
                <button 
                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                  aria-label="Выбрать модель"
                  className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 flex items-center justify-between cursor-pointer active:border-white/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${currentModel.color} flex items-center justify-center text-[10px] font-bold shadow-lg`}>
                      {currentModel.badge}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[15px] font-medium text-white">
                        {currentModel.name}
                      </span>
                      <span className="text-[11px] text-white/40 text-left">
                        {currentModel.desc}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`transition-transform duration-300 ${isModelMenuOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={16} className="text-white/40" />
                  </div>
                </button>

                <AnimatePresence>
                  {isModelMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute top-full mt-2 left-0 right-0 bg-[#1c1c1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[60]"
                    >
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setModelId(m.id); setIsModelMenuOpen(false); }}
                          className="w-full text-left px-3 py-3 hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${m.color} flex items-center justify-center text-[10px] font-bold shadow-inner`}>
                              {m.badge}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-medium text-white">{m.name}</span>
                              <span className="text-[10px] text-white/40">{m.desc}</span>
                              <span className="text-[11px] text-amber-400 font-medium mt-1">
                                {m.price} монет
                              </span>
                            </div>
                          </div>
                          
                          {modelId === m.id && <Check size={16} className="text-yellow-500" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Изображения */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-white/60 ml-1">Изображения</label>
              <div className="grid grid-cols-4 gap-2">
                {/* Ячейка для загрузки / предпросмотра */}
                <div className="aspect-square bg-[#1c1c1e] border border-white/10 border-dashed rounded-xl overflow-hidden relative">
                  {referencePreview ? (
                    // Режим предпросмотра — не кликабельный для загрузки
                    <div className="relative w-full h-full">
                      <img src={referencePreview} className="w-full h-full object-cover" alt="Preview" />
                      <button 
                        onClick={handleRemoveImage}
                        aria-label="Удалить изображение"
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white/70 hover:bg-black/90 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    // Кнопка загрузки (label)
                    <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                      />
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <ImageIcon size={16} className="text-white/60" />
                      </div>
                      <span className="text-[9px] text-center text-white/40 px-1 leading-tight">Загрузить фото</span>
                    </label>
                  )}
                </div>
                
                <div className="col-span-3 bg-[#1c1c1e] border border-white/10 rounded-xl p-4 flex items-center justify-center text-center">
                  <p className="text-[11px] text-white/30 leading-snug">
                    Загрузите одно или несколько изображений для редактирования.
                  </p>
                </div>
              </div>
            </div>

            {/* Запрос */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-white/60 ml-1">
                Запрос <span className="text-yellow-500">*</span>
              </label>
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="Опишите, что должно быть на изображении..."
                className="w-full h-32 bg-[#1c1c1e] border border-white/10 rounded-xl p-4 text-[15px] text-white placeholder:text-white/20 outline-none focus:border-white/30 resize-none transition-colors"
              />
            </div>

            {/* Соотношение сторон */}
            <div className="space-y-2 pb-24 relative">
              <label className="text-[13px] font-medium text-white/60 ml-1">Соотношение сторон</label>
              
              <div className="relative">
                <button 
                  onClick={() => setIsRatioMenuOpen(!isRatioMenuOpen)}
                  aria-label="Выбрать соотношение сторон"
                  className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl p-3 flex items-center justify-between active:border-white/30 transition-colors"
                >
                   <span className="text-[15px] font-medium text-white">
                     {aspectRatio === "auto" ? "Автоматически" : aspectRatio}
                   </span>
                   <div className={`transition-transform duration-300 ${isRatioMenuOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown size={16} className="text-white/40" />
                   </div>
                </button>

                <AnimatePresence>
                  {isRatioMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full mb-2 left-0 right-0 bg-[#1c1c1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto"
                    >
                      <button
                          onClick={() => { setAspectRatio("auto"); setIsRatioMenuOpen(false); }}
                          className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                        >
                          <span>Автоматически</span>
                          {aspectRatio === "auto" && <Check size={14} className="text-yellow-500" />}
                      </button>

                      {["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"].map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => { setAspectRatio(ratio); setIsRatioMenuOpen(false); }}
                          className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0"
                        >
                          <span>{ratio}</span>
                          {aspectRatio === ratio && <Check size={14} className="text-yellow-500" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Кнопка генерации */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#111] border-t border-white/5 pb-safe">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isPromptEmpty}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC000] text-black font-bold text-[16px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.2)] disabled:pointer-events-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Генерация...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} fill="black" />
                  <span>Сгенерировать – {currentModel.price} монет</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}