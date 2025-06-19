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

// AI API 호출 제한을 위한 세마포어 클래스
class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.maxConcurrent) {
        this.running++;
        resolve();
      } else {
        this.queue.push(() => {
          this.running++;
          resolve();
        });
      }
    });
  }

  release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// 번역 API와 비디오 생성 API에 대한 세마포어
const translationSemaphore = new Semaphore(API_CONFIG.MAX_CONCURRENT_TRANSLATIONS);
const videoGenerationSemaphore = new Semaphore(API_CONFIG.MAX_CONCURRENT_VIDEO_GENERATIONS);

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

    // 세마포어를 사용하여 동시 번역 요청 수 제한
    await translationSemaphore.acquire();
    
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
    } finally {
      translationSemaphore.release();
    }
  }
}

export class VideoGenerationService {
  static async generateVideo(
    englishPrompt: string, 
    outputGcsUri?: string,
    model: string = 'veo-2.0-generate-001'
  ) {
    const startTime = Date.now();
    
    Logger.step("Video Generation Service - Starting video generation", {
      service: "Veo",
      model: model,
      promptLength: englishPrompt.length,
      promptPreview: englishPrompt.substring(0, 100) + "...",
      outputGcsUri: outputGcsUri || "not configured"
    });
    
    // 세마포어를 사용하여 동시 비디오 생성 요청 수 제한
    await videoGenerationSemaphore.acquire();
    
    try {
      Logger.step("Video Generation Service - Calling Veo API", {
        prompt: englishPrompt.substring(0, 100) + "...",
        model
      });

      const videos = await withRetry(async () => {
        let operation = await ai.models.generateVideos({
          model: model,
          prompt: englishPrompt,
          config: {
            aspectRatio: '16:9',
            numberOfVideos: 1,
            durationSeconds: 8,
            enhancePrompt: true,
            generateAudio: false,
            outputGcsUri: outputGcsUri,
            personGeneration: PersonGeneration.ALLOW_ALL,
          }
        });

        Logger.step("Video Generation Service - Operation started, waiting for completion", {
          operationId: operation.name || 'unknown',
          status: operation.done ? 'completed' : 'in-progress'
        });

        let checkCount = 0;
        while (!operation.done) {
          checkCount++;
          Logger.debug("Video Generation Service - Checking operation status", {
            checkCount,
            operationId: operation.name || 'unknown'
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videos = operation.response?.generatedVideos;
        if (videos === undefined || videos.length === 0) {
          throw new Error('No videos generated');
        }

        Logger.step("Video Generation Service - Video generation completed", {
          videoCount: videos.length,
          checksPerformed: checkCount,
          firstVideo: videos[0] ? 'generated' : 'none'
        });

        return videos;
      }, API_CONFIG.MAX_RETRIES, API_CONFIG.RETRY_BASE_DELAY, 'Video generation API call');
      
      const duration = Date.now() - startTime;
      
      Logger.step("Video Generation Service - Video generation completed", {
        duration: duration,
        durationMs: `${duration}ms`,
        videosGenerated: videos.length,
        hasOutputUri: !!outputGcsUri
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
    } finally {
      videoGenerationSemaphore.release();
    }
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