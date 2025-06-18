import { GenerateContentConfig, GoogleGenAI, HarmCategory, HarmBlockThreshold, PersonGeneration } from '@google/genai';
import { Logger } from './logger';

const ai = new GoogleGenAI({
  vertexai: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

export class TranslationService {
  static async translateKoreanToEnglish(koreanText: string): Promise<string> {
    const startTime = Date.now();
    
    Logger.step("Translation Service - Starting translation", {
      service: "Gemini",
      model: "gemini-2.0-flash-lite-001",
      inputLength: koreanText.length,
      inputPreview: koreanText.substring(0, 50) + "..."
    });
    
    const generationConfig: GenerateContentConfig = {
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
      systemInstruction: {
        parts: [{"text": `You are a professional translator.  You must only generate the translated text, no other text or comments.`}]
      },
    };

    Logger.step("Translation Service - Calling Gemini API", {
      config: {
        maxOutputTokens: generationConfig.maxOutputTokens,
        temperature: generationConfig.temperature,
        topP: generationConfig.topP
      }
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite-001',
        contents: [
          {
            role: 'user',
            parts: [{"text": `Please translate the following Korean text into English: ${koreanText}`}]
          }
        ],
        config: generationConfig  
      });
      
      const duration = Date.now() - startTime;
      const translatedText = response.text || '';
      
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
  static async generateVideo(englishPrompt: string, outputGcsUri?: string) {
    const startTime = Date.now();
    
    Logger.step("Video Generation Service - Starting video generation", {
      service: "Veo",
      model: "veo-2.0-generate-001",
      promptLength: englishPrompt.length,
      promptPreview: englishPrompt.substring(0, 100) + "...",
      outputGcsUri: outputGcsUri || "not configured"
    });
    
    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
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

      const duration = Date.now() - startTime;
      Logger.step("Video Generation Service - Video generation completed", {
        duration: duration,
        durationMs: `${duration}ms`,
        videoCount: videos.length,
        checksPerformed: checkCount,
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

  static async downloadVideo(video: any, downloadPath: string) {
    Logger.step("Video Generation Service - Starting video download", {
      downloadPath,
      videoInfo: video ? 'available' : 'unavailable'
    });
    
    try {
      const result = await ai.files.download({
        file: video,
        downloadPath: downloadPath,
      });
      
      Logger.step("Video Generation Service - Video download completed", {
        downloadPath
      });
      
      return result;
    } catch (error) {
      Logger.error("Video Generation Service - Video download failed", {
        downloadPath,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
} 