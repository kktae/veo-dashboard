export interface VideoGenerationRequest {
  koreanPrompt: string;
}

export interface TranslationResult {
  koreanText: string;
  englishText: string;
}

export interface VideoGenerationResult {
  id: string;
  koreanPrompt: string;
  englishPrompt: string;
  status: 'pending' | 'translating' | 'generating' | 'processing' | 'completed' | 'error';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface VideoGenerationState {
  results: VideoGenerationResult[];
  isLoading: boolean;
  error: string | null;
  selectedIds: string[];
} 