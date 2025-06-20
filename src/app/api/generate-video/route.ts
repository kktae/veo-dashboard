import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { updateVideoRecord } from '@/lib/database';
import { validateResolution } from '@/lib/video-utils';
import { AIModelConfig } from '@/types';

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

    // 1. Translate Korean prompt to English
    const englishPrompt = await translateText(koreanPrompt, config, videoId);

    // 2. Update database status to generating and save English prompt
    await updateVideoRecord(videoId, { 
      status: 'generating',
      english_prompt: englishPrompt
    });
    Logger.step('Database updated with translated prompt and generating status', { videoId });


    // 3. Start background processing (don't await)
    processVideoGeneration(
      videoId, 
      englishPrompt, 
      config.videoGenerationModel, 
      0, 
      config.durationSeconds
    ).catch(error => {
      Logger.error('Background video generation failed to start', {
        videoId,
        error: error instanceof Error ? error.message : error
      });
    });

    // 4. Return immediate success response
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
async function processVideoGeneration(videoId: string, englishPrompt: string, model: string, retryCount: number = 0, durationSeconds?: number) {
  const startTime = Date.now();
  const maxRetries = 3;
  
  try {
    Logger.step('Background video generation started', { 
      videoId,
      promptLength: englishPrompt.length,
      preview: englishPrompt.substring(0, 100) + '...',
      outputUri: process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI,
      model,
      retryCount,
      maxRetries
    });

    const videos = await VideoGenerationService.generateVideo(
      englishPrompt,
      process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI,
      model,
      durationSeconds
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
        processVideoGeneration(videoId, englishPrompt, model, retryCount + 1, durationSeconds).catch(retryError => {
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