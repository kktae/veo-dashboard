export interface VideoGenerationRequest {
  koreanPrompt: string;
  userEmail: string;
}

export interface TranslationResult {
  koreanText: string;
  englishText: string;
}

export interface VideoGenerationResult {
  id: string;
  koreanPrompt: string;
  englishPrompt: string;
  userEmail: string;
  status: 'pending' | 'translating' | 'generating' | 'processing' | 'completed' | 'error';
  videoUrl?: string;
  thumbnailUrl?: string;
  gcsUri?: string;
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

export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: Date;
  tags: string[];
  prompt: string;
  status: 'generating' | 'completed' | 'failed';
}

export interface GenerationRequest {
  prompt: string;
  userId?: string;
}

export interface GenerationResponse {
  id: string;
  status: 'generating' | 'completed' | 'failed';
  videos?: Video[];
  error?: string;
}

export interface VideoStats {
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  generatingVideos: number;
}

// AI Model Selection Types
export interface TranslationModel {
  id: string;
  name: string;
  description?: string;
}

export interface VideoGenerationModel {
  id: string;
  name: string;
  description?: string;
  capabilities: {
    durationRange: {
      min: number;
      max: number;
      fixed?: number;
    };
    supportsAudioGeneration: boolean;
    supportsVideoExtension: boolean;
    supportsLastFrame: boolean;
    promptRewriter: {
      supported: boolean;
      canDisable: boolean;
      enhancesPromptsUnder30Words: boolean;
    };
    aspectRatios: string[];
    videoFormats: string[];
  };
}

export interface TranslationPromptConfig {
  systemInstruction: string;
  userPromptTemplate: string;
}

export interface AIModelConfig {
  translationModel: string;
  videoGenerationModel: string;
  translationPromptConfig: TranslationPromptConfig;
  durationSeconds: number;
  enhancePrompt: boolean;
  generateAudio: boolean;
  negativePrompt: string;
  aspectRatio: string;
}

// Default configurations
export const DEFAULT_TRANSLATION_MODELS: TranslationModel[] = [
  {
    id: 'gemini-2.0-flash-lite-001',
    name: 'Gemini 2.0 Flash Lite',
    description: '가장 빠르고 비용 효율적인 모델'
  },
  {
    id: 'gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: '고품질 번역'
  },
];

export const DEFAULT_VIDEO_GENERATION_MODELS: VideoGenerationModel[] = [
  {
    id: 'veo-2.0-generate-001',
    name: 'Veo 2.0',
    description: '기존 비디오 생성 모델 (GA)',
    capabilities: {
      durationRange: { min: 5, max: 8 },
      supportsAudioGeneration: false,
      supportsVideoExtension: true,
      supportsLastFrame: true,
      promptRewriter: {
        supported: true,
        canDisable: true,
        enhancesPromptsUnder30Words: true
      },
      aspectRatios: ['16:9', '9:16'],
      videoFormats: ['video/mp4']
    }
  },
  {
    id: 'veo-3.0-generate-preview',
    name: 'Veo 3.0 (Preview)',
    description: '최신 프리뷰 비디오 생성 모델',
    capabilities: {
      durationRange: { min: 8, max: 8, fixed: 8 },
      supportsAudioGeneration: true,
      supportsVideoExtension: false,
      supportsLastFrame: false,
      promptRewriter: {
        supported: true,
        canDisable: false,
        enhancesPromptsUnder30Words: true
      },
      aspectRatios: ['16:9'],
      videoFormats: ['video/mp4']
    }
  }
];

export const DEFAULT_TRANSLATION_PROMPT_CONFIG: TranslationPromptConfig = {
  systemInstruction: 'You are a professional translator. You must only generate the translated text, no other text or comments.',
  userPromptTemplate: 'Please translate the following Korean text into English: {text}'
};

export const DEFAULT_AI_MODEL_CONFIG: AIModelConfig = {
  translationModel: 'gemini-2.0-flash-lite-001',
  videoGenerationModel: 'veo-2.0-generate-001',
  durationSeconds: 8,
  translationPromptConfig: DEFAULT_TRANSLATION_PROMPT_CONFIG,
  enhancePrompt: true,
  generateAudio: false,
  negativePrompt: '',
  aspectRatio: '16:9'
}; 