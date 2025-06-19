import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { updateVideoRecord } from '@/lib/database';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/generate-video';
  
  try {
    const { 
      englishPrompt,
      videoId,
      model = 'veo-2.0-generate-001'
    } = await request.json();

    Logger.apiStart(route, { 
      videoId,
      englishPrompt: englishPrompt?.substring(0, 100) + '...',
      gcsUri: process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI ? 'configured' : 'not configured',
      model
    });

    if (!englishPrompt || !videoId) {
      Logger.warn('Video generation request missing required parameters', { route, videoId, hasPrompt: !!englishPrompt });
      return NextResponse.json(
        { error: 'English prompt and video ID are required' },
        { status: 400 }
      );
    }

    // Update database status to generating and save english prompt
    await updateVideoRecord(videoId, { 
      status: 'generating',
      english_prompt: englishPrompt
    });

    // Return immediately with job ID
    const response = NextResponse.json({ 
      success: true, 
      videoId,
      status: 'generating',
      message: 'Video generation started'
    });

    // Start background processing (don't await)
    processVideoGeneration(videoId, englishPrompt, model).catch(error => {
      Logger.error('Background video generation failed', {
        videoId,
        error: error instanceof Error ? error.message : error
      });
    });

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, {
      videoId,
      status: 'generating',
      totalDuration: `${duration}ms`,
      model
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Video generation failed to start' },
      { status: 500 }
    );
  }
}

// Background processing function
async function processVideoGeneration(videoId: string, englishPrompt: string, model: string, retryCount: number = 0) {
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
      model
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

    // Update with final results
    await updateVideoRecord(videoId, {
      status: 'completed',
      video_url: processResult.videoUrl,
      thumbnail_url: processResult.thumbnailUrl,
      duration: processResult.duration || 8,
      resolution: processResult.resolution || '1920x1080',
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
        processVideoGeneration(videoId, englishPrompt, model, retryCount + 1).catch(retryError => {
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