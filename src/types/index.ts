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
  status: 'pending' | 'translating' | 'generating' | 'completed' | 'error';
  videoUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface VideoGenerationState {
  results: VideoGenerationResult[];
  isLoading: boolean;
  error: string | null;
} 