import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { updateVideoRecord, isVideoGenerationEnabled } from '@/lib/database';
import { validateResolution } from '@/lib/video-utils';
import { AIModelConfig } from '@/types';

// 비디오 생성 기능 상태 확인 함수
async function checkVideoGenerationStatus(): Promise<boolean> {
  try {
    return await isVideoGenerationEnabled();
  } catch (error) {
    Logger.warn('Failed to check video generation status from database, defaulting to enabled', { error });
    return true; // 에러 시 기본적으로 활성화
  }
}

async function translateText(koreanText: string, config: AIModelConfig, videoId: string): Promise<string> {
  Logger.step('Starting translation process', { videoId, model: config.translationModel });
  
  const translateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      koreanText,
      model: config.translationModel,
      promptConfig: config.translationPromptConfig,
    }),
  });

  if (!translateResponse.ok) {
    const errorText = await translateResponse.text();
    Logger.error('Translation API call failed', { videoId, status: translateResponse.status, error: errorText });
    throw new Error(`Translation failed: ${errorText}`);
  }

  const data = await translateResponse.json();
  Logger.step('Translation process completed', { videoId, englishPrompt: data.englishText.substring(0, 100) + '...' });
  return data.englishText;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/generate-video';
  let videoId: string | null = null;
  
  try {
    // 1. 가장 먼저 비디오 생성 기능 활성화 상태 확인
    const isGenerationEnabled = await checkVideoGenerationStatus();
    if (!isGenerationEnabled) {
      Logger.warn('Video generation is currently disabled by admin - request blocked before processing', { route });
      return NextResponse.json(
        { error: 'Video generation is currently disabled. Please contact admin.' },
        { status: 503 }
      );
    }

    // 2. 요청 데이터 파싱
    const { 
      videoId: reqVideoId,
      koreanPrompt,
      config,
      userEmail
    } = await request.json();
    
    videoId = reqVideoId;

    Logger.apiStart(route, { 
      videoId,
      koreanPrompt: koreanPrompt?.substring(0, 100) + '...',
      userEmail,
      model: config.videoGenerationModel,
    });

    // 3. 필수 파라미터 검증
    if (!koreanPrompt || !videoId || !config || !userEmail) {
      Logger.warn('Video generation request missing required parameters', { 
        route, 
        videoId, 
        hasPrompt: !!koreanPrompt, 
        hasConfig: !!config,
        hasUserEmail: !!userEmail
      });
      return NextResponse.json(
        { error: 'Video ID, Korean prompt, user email, and config are required' },
        { status: 400 }
      );
    }

    // 4. Translate Korean prompt to English
    const englishPrompt = await translateText(koreanPrompt, config, videoId);

    // 5. Update database status to generating and save English prompt
    await updateVideoRecord(videoId, { 
      status: 'generating',
      english_prompt: englishPrompt
    });
    Logger.step('Database updated with translated prompt and generating status', { videoId });

    // 6. Start background processing (don't await)
    processVideoGeneration(
      videoId, 
      englishPrompt, 
      config
    ).catch(error => {
      Logger.error('Background video generation failed to start', {
        videoId,
        error: error instanceof Error ? error.message : error
      });
    });

    // 7. Return immediate success response
    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, {
      videoId,
      status: 'generating',
      totalDuration: `${duration}ms`,
      model: config.videoGenerationModel
    });

    return NextResponse.json({ 
      success: true, 
      videoId,
      status: 'generating',
      message: 'Video generation workflow started successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    // If an error occurs, update the video record status to 'error'
    if (videoId) {
      await updateVideoRecord(videoId, {
        status: 'error',
        error_message: error instanceof Error ? `Workflow start failed: ${error.message}` : 'Unknown error during startup'
      });
    }

    return NextResponse.json(
      { error: 'Video generation workflow failed to start' },
      { status: 500 }
    );
  }
}

// Background processing function
async function processVideoGeneration(videoId: string, englishPrompt: string, config: AIModelConfig, retryCount: number = 0) {
  const startTime = Date.now();
  const maxRetries = 3;
  
  try {
    Logger.step('Background video generation started', { 
      videoId,
      promptLength: englishPrompt.length,
      preview: englishPrompt.substring(0, 100) + '...',
      outputUri: process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI,
      model: config.videoGenerationModel,
      durationSeconds: config.durationSeconds,
      enhancePrompt: config.enhancePrompt,
      generateAudio: config.generateAudio,
      hasNegativePrompt: !!config.negativePrompt,
      retryCount,
      maxRetries
    });

    const videos = await VideoGenerationService.generateVideo(
      englishPrompt,
      process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI,
      config.videoGenerationModel,
      config.durationSeconds,
      config.enhancePrompt,
      config.generateAudio,
      config.negativePrompt
    );

    if (!videos || videos.length === 0) {
      throw new Error('No videos generated from API');
    }

    const generatedVideo = videos[0];
    const gcsUri = generatedVideo?.video?.uri;
    
    if (!gcsUri) {
      throw new Error('No video URI returned from generation API');
    }

    // Update status to processing
    await updateVideoRecord(videoId, { status: 'processing' });

    // Process the video (download and create thumbnail)
    const processResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/process-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        gcsUri: gcsUri,
        videoId: videoId
      }),
    });

    if (!processResponse.ok) {
      throw new Error(`Video processing failed: ${processResponse.status}`);
    }

    const processResult = await processResponse.json();
    const duration = Date.now() - startTime;

    // Update with final results (해상도 값 검증 후 저장)
    const validResolution = validateResolution(processResult.resolution, videoId);
    
    if (processResult.resolution && !validResolution) {
      Logger.warn('Invalid resolution from video processing, not saving to DB', {
        videoId,
        invalidResolution: processResult.resolution
      });
    }
    
    await updateVideoRecord(videoId, {
      status: 'completed',
      video_url: processResult.videoUrl,
      thumbnail_url: processResult.thumbnailUrl,
      duration: processResult.duration || 8,
      resolution: validResolution, // 검증된 해상도만 저장
      completed_at: new Date().toISOString(),
    });

    Logger.info('Background video generation completed successfully', {
      videoId,
      totalDuration: `${duration}ms`,
      videoUrl: processResult.videoUrl,
      thumbnailUrl: processResult.thumbnailUrl,
      actualDuration: processResult.duration,
      resolution: processResult.resolution,
      retryCount,
      success: true
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Retry logic
    if (retryCount < maxRetries) {
      const delayMs = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
      
      Logger.warn('Background video generation failed, retrying', {
        videoId,
        totalDuration: `${duration}ms`,
        error: errorMessage,
        retryCount,
        maxRetries,
        nextRetryIn: `${delayMs}ms`
      });

      // Schedule retry
      setTimeout(() => {
        processVideoGeneration(videoId, englishPrompt, config, retryCount + 1).catch(retryError => {
          Logger.error('Retry also failed', {
            videoId,
            retryCount: retryCount + 1,
            error: retryError instanceof Error ? retryError.message : retryError
          });
        });
      }, delayMs);
      
      return; // Don't mark as error yet
    }
    
    Logger.error('Background video generation failed after all retries', {
      videoId,
      totalDuration: `${duration}ms`,
      error: errorMessage,
      retryCount,
      maxRetries,
      success: false
    });

    // Update database with error only after all retries exhausted
    await updateVideoRecord(videoId, {
      status: 'error',
      error_message: `${errorMessage} (after ${retryCount} retries)`,
    });
  }
} 