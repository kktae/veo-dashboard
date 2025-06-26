import { GenerateContentConfig, GoogleGenAI, HarmCategory, HarmBlockThreshold, PersonGeneration } from '@google/genai';
import { Logger } from './logger';
import { TranslationPromptConfig } from '@/types';
import { API_CONFIG } from './constants';
import { withRetry } from './api-utils';

const ai = new GoogleGenAI({
  vertexai: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

// Common generation config
const getBaseGenerationConfig = (customConfig?: Partial<GenerateContentConfig>): GenerateContentConfig => ({
  maxOutputTokens: 1024,
  temperature: 0.4,
  topP: 0.95,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.OFF,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.OFF,
    }
  ],
  ...customConfig
});

export class TranslationService {
  static async translateKoreanToEnglish(
    koreanText: string,
    model: string = 'gemini-2.0-flash-lite-001',
    promptConfig?: TranslationPromptConfig
  ): Promise<string> {
    const startTime = Date.now();
    
    // Use default prompt config if not provided
    const defaultPromptConfig = {
      systemInstruction: 'You are a professional translator. You must only generate the translated text, no other text or comments.',
      userPromptTemplate: 'Please translate the following Korean text into English: {text}'
    };
    
    const config = promptConfig || defaultPromptConfig;
    const userPrompt = config.userPromptTemplate.replace('{text}', koreanText);
    
    Logger.step("Translation Service - Starting translation", {
      service: "Gemini",
      model: model,
      inputLength: koreanText.length,
      inputPreview: koreanText.substring(0, 50) + "...",
      systemInstruction: config.systemInstruction.substring(0, 50) + "...",
      userPromptTemplate: config.userPromptTemplate.substring(0, 50) + "..."
    });
    
    const generationConfig = getBaseGenerationConfig({
      systemInstruction: {
        parts: [{"text": config.systemInstruction}]
      }
    });

    try {
      Logger.step("Translation Service - Calling Gemini API", {
        config: {
          maxOutputTokens: generationConfig.maxOutputTokens,
          temperature: generationConfig.temperature,
          topP: generationConfig.topP
        }
      });

      const translatedText = await withRetry(async () => {
        const response = await ai.models.generateContent({
          model: model,
          contents: [
            {
              role: 'user',
              parts: [{"text": userPrompt}]
            }
          ],
          config: generationConfig  
        });
        
        return response.text || '';
      }, API_CONFIG.MAX_RETRIES, 1000, 'Translation API call');
      
      const duration = Date.now() - startTime;
      
      Logger.step("Translation Service - Translation completed", {
        duration: duration,
        durationMs: `${duration}ms`,
        outputLength: translatedText.length,
        outputPreview: translatedText.substring(0, 100) + "..."
      });
      
      return translatedText;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error("Translation Service - Translation failed", {
        duration: duration,
        durationMs: `${duration}ms`,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
}

export class VideoGenerationService {
  // 모델별 capabilities 정의 (프론트엔드와 동일)
  private static readonly MODEL_CAPABILITIES = {
    'veo-2.0-generate-001': {
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
    },
    'veo-3.0-generate-preview': {
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
  };

  // 모델별 파라미터 검증
  private static validateModelParameters(
    model: string,
    durationSeconds: number,
    generateAudio: boolean,
    enhancePrompt: boolean,
    aspectRatio: string
  ): { isValid: boolean; errors: string[] } {
    const capabilities = this.MODEL_CAPABILITIES[model as keyof typeof this.MODEL_CAPABILITIES];
    const errors: string[] = [];

    if (!capabilities) {
      errors.push(`Unsupported model: ${model}`);
      return { isValid: false, errors };
    }

    // Duration validation
    if ('fixed' in capabilities.durationRange) {
      if (durationSeconds !== capabilities.durationRange.fixed) {
        errors.push(`${model} requires fixed duration of ${capabilities.durationRange.fixed} seconds`);
      }
    } else {
      const { min, max } = capabilities.durationRange;
      if (durationSeconds < min || durationSeconds > max) {
        errors.push(`${model} duration must be between ${min}-${max} seconds`);
      }
    }

    // Audio generation validation
    if (generateAudio && !capabilities.supportsAudioGeneration) {
      errors.push(`${model} does not support audio generation`);
    }

    // Prompt rewriter validation
    if (!enhancePrompt && !capabilities.promptRewriter.canDisable) {
      errors.push(`${model} requires prompt rewriter to be enabled`);
    }

    // Aspect ratio validation
    if (!capabilities.aspectRatios.includes(aspectRatio)) {
      errors.push(`${model} does not support aspect ratio ${aspectRatio}. Supported ratios: ${capabilities.aspectRatios.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  static async generateVideo(
    englishPrompt: string, 
    outputGcsUri?: string,
    model: string = 'veo-2.0-generate-001',
    durationSeconds: number = 8,
    enhancePrompt: boolean = true,
    generateAudio: boolean = false,
    negativePrompt: string = ''
  ) {
    const startTime = Date.now();
    
    // 모델별 파라미터 검증
    const validation = this.validateModelParameters(model, durationSeconds, generateAudio, enhancePrompt, '16:9');
    if (!validation.isValid) {
      const errorMessage = `Invalid parameters for ${model}: ${validation.errors.join(', ')}`;
      Logger.error("Video Generation Service - Parameter validation failed", {
        model,
        durationSeconds,
        generateAudio,
        enhancePrompt,
        errors: validation.errors
      });
      throw new Error(errorMessage);
    }
    
    Logger.step("Video Generation Service - Starting video generation", {
      service: "Veo",
      model: model,
      promptLength: englishPrompt.length,
      promptPreview: englishPrompt.substring(0, 100) + "...",
      outputGcsUri: outputGcsUri || "not configured",
      durationSeconds,
      enhancePrompt,
      generateAudio,
      hasNegativePrompt: !!negativePrompt
    });
    
    try {
      Logger.step("Video Generation Service - Calling Veo API", {
        prompt: englishPrompt.substring(0, 100) + "...",
        model,
        durationSeconds,
        enhancePrompt,
        generateAudio,
        negativePrompt: negativePrompt ? negativePrompt.substring(0, 50) + "..." : "none"
      });

      const videos = await withRetry(async () => {
                            // API 파라미터 구성 - 모델별 지원 여부에 따라 동적 구성
          const capabilities = VideoGenerationService.MODEL_CAPABILITIES[model as keyof typeof VideoGenerationService.MODEL_CAPABILITIES];
          const videoConfig: any = {
            aspectRatio: '16:9',
            numberOfVideos: 1,
            durationSeconds: durationSeconds,
            outputGcsUri: outputGcsUri,
            personGeneration: PersonGeneration.ALLOW_ALL,
          };

          // 프롬프트 재작성기 설정 (모델이 지원하는 경우만)
          if (capabilities?.promptRewriter.supported) {
            videoConfig.enhancePrompt = enhancePrompt;
          }

          // 오디오 생성 설정 (모델이 지원하는 경우만)
          if (capabilities?.supportsAudioGeneration) {
            videoConfig.generateAudio = generateAudio;
          }

          // Add negative prompt only if provided
          if (negativePrompt && negativePrompt.trim()) {
            videoConfig.negativePrompt = negativePrompt.trim();
          }

          // Start the long-running operation
          let operation = await ai.models.generateVideos({
            model: model,
            prompt: englishPrompt,
            config: videoConfig
          });

        const operationName = operation.name;
        if (!operationName) {
          throw new Error('No operation name returned from video generation request');
        }

        Logger.step("Video Generation Service - Long-running operation started", {
          operationName: operationName,
          operationId: operationName.split('/').pop() || 'unknown',
          status: operation.done ? 'completed' : 'in-progress'
        });

        // Poll the operation status with improved logic
        const videos = await this.pollVideoGenerationOperation(operation);
        
        if (!videos || videos.length === 0) {
          throw new Error('No videos generated');
        }

        return videos;
      }, API_CONFIG.MAX_RETRIES, API_CONFIG.RETRY_BASE_DELAY, 'Video Generation API call');
      
      const duration = Date.now() - startTime;
      
      Logger.step("Video Generation Service - Video generation completed", {
        duration: duration,
        durationMs: `${duration}ms`,
        videosGenerated: videos.length,
        firstVideo: videos[0] ? 'generated' : 'none'
      });
      
      return videos;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error("Video Generation Service - Video generation failed", {
        duration: duration,
        durationMs: `${duration}ms`,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Poll video generation operation status with improved error handling
   * Following the best practices from Google Cloud documentation
   */
  private static async pollVideoGenerationOperation(operation: any): Promise<any[]> {
    const startTime = Date.now();
    let checkCount = 0;
    const config = API_CONFIG.VIDEO_GENERATION;
    const basePollingInterval = Math.max(API_CONFIG.POLLING_INTERVAL, config.MIN_POLLING_INTERVAL);
    const operationName = operation.name;

    Logger.step("Video Generation Service - Starting operation polling", {
      operationName,
      basePollingInterval: `${basePollingInterval}ms`,
      maxPollingTime: `${config.MAX_POLLING_TIME}ms`,
      initialStatus: operation.done ? 'completed' : 'in-progress'
    });

    // If already done, return immediately
    if (operation.done) {
      const videos = operation.response?.generatedVideos;
      if (!videos || videos.length === 0) {
        throw new Error('No videos found in completed operation response');
      }
      return videos;
    }

    let currentOperation = operation;
    let consecutiveErrors = 0;

    while (Date.now() - startTime < config.MAX_POLLING_TIME) {
      checkCount++;
      
      // Calculate exponential backoff with jitter for polling interval
      const exponentialBackoff = Math.min(basePollingInterval * Math.pow(config.EXPONENTIAL_BACKOFF_FACTOR, Math.floor(checkCount / 5)), config.MAX_POLLING_INTERVAL);
      const jitter = Math.random() * config.JITTER_MAX; // Add random jitter
      const pollingInterval = exponentialBackoff + jitter;
      
      try {
        Logger.debug("Video Generation Service - Polling operation status", {
          checkCount,
          operationName,
          elapsedTime: `${Date.now() - startTime}ms`,
          nextPollIn: `${Math.round(pollingInterval)}ms`,
          consecutiveErrors
        });

        // Wait before polling (except for first check)
        if (checkCount > 1) {
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // Poll operation status
        currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });

        // Reset consecutive errors on successful poll
        consecutiveErrors = 0;

        // Check if operation is completed
        if (currentOperation.done) {
          Logger.step("Video Generation Service - Operation completed", {
            checkCount,
            totalTime: `${Date.now() - startTime}ms`,
            operationName
          });

          // Extract videos from the response
          const videos = currentOperation.response?.generatedVideos;
          if (!videos || videos.length === 0) {
            throw new Error('No videos found in completed operation response');
          }

          Logger.step("Video Generation Service - Videos extracted from operation", {
            videoCount: videos.length,
            hasFirstVideo: !!videos[0]
          });

          return videos;
        }

                 // Operation is still running
         Logger.debug("Video Generation Service - Operation still in progress", {
           checkCount,
           operationName,
           timeRemaining: `${config.MAX_POLLING_TIME - (Date.now() - startTime)}ms`
         });

      } catch (error) {
        consecutiveErrors++;
        
                 // Handle rate limiting (429 errors) with longer backoff
         if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
           const rateLimitDelay = Math.min(config.RATE_LIMIT_BACKOFF_MAX, basePollingInterval * Math.pow(2, consecutiveErrors));
           Logger.warn("Video Generation Service - Rate limit encountered, backing off", {
             checkCount,
             consecutiveErrors,
             error: error.message,
             backoffDelay: `${rateLimitDelay}ms`
           });
           
           await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
           consecutiveErrors = Math.max(0, consecutiveErrors - 1); // Reduce error count after rate limit handling
           continue;
         }

         // Handle transient errors with retry
         if (consecutiveErrors <= config.MAX_CONSECUTIVE_ERRORS) {
           const retryDelay = basePollingInterval * Math.pow(2, consecutiveErrors);
           Logger.warn("Video Generation Service - Polling error, retrying", {
             checkCount,
             consecutiveErrors,
             maxConsecutiveErrors: config.MAX_CONSECUTIVE_ERRORS,
             error: error instanceof Error ? error.message : error,
             retryDelay: `${retryDelay}ms`
           });
           
           await new Promise(resolve => setTimeout(resolve, retryDelay));
           continue;
         }
        
        // For persistent errors, throw
        Logger.error("Video Generation Service - Polling failed with persistent error", {
          checkCount,
          consecutiveErrors,
          error: error instanceof Error ? error.message : error,
          operationName
        });
        throw error;
      }
    }

    // Timeout reached
    const timeoutError = new Error(`Video generation operation timed out after ${config.MAX_POLLING_TIME}ms`);
    Logger.error("Video Generation Service - Operation polling timeout", {
      checkCount,
      timeoutMs: config.MAX_POLLING_TIME,
      operationName,
      consecutiveErrors
    });
    throw timeoutError;
  }
  
  static async downloadVideo(video: any, downloadPath: string) {
    const startTime = Date.now();
    
    Logger.step("Video Generation Service - Downloading video", {
      downloadPath,
      hasVideo: !!video
    });
    
    try {
      await withRetry(async () => {
        await video.download(downloadPath);
      }, API_CONFIG.MAX_RETRIES, 2000, 'Video download');
      
      const duration = Date.now() - startTime;
      Logger.step("Video Generation Service - Video download completed", {
        duration: duration,
        durationMs: `${duration}ms`,
        downloadPath
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error("Video Generation Service - Video download failed", {
        duration: duration,
        durationMs: `${duration}ms`,
        downloadPath,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
} 