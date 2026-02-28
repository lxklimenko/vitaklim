'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { useImageGeneration } from '@/app/hooks/useImageGeneration';
import { GenerateModal } from '@/app/components/GenerateModal';

export default function GeneratePage() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    generatePrompt,
    setGeneratePrompt,
    isGenerating,
    modelId,
    setModelId,
    aspectRatio,
    setAspectRatio,
    referencePreview,
    handleFileChange,
    handleRemoveImage,
    handleGenerate
  } = useImageGeneration(user, () => {});

  return (
    <GenerateModal
      isOpen={true}
      onClose={() => router.back()}
      generatePrompt={generatePrompt}
      setGeneratePrompt={setGeneratePrompt}
      isGenerating={isGenerating}
      handleGenerate={handleGenerate}
      modelId={modelId}
      setModelId={setModelId}
      aspectRatio={aspectRatio}
      setAspectRatio={setAspectRatio}
      referencePreview={referencePreview}
      handleFileChange={handleFileChange}
      handleRemoveImage={handleRemoveImage}
    />
  );
}