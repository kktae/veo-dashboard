import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/generate-video';
  
  try {
    const { englishPrompt } = await request.json();

    Logger.apiStart(route, { 
      englishPrompt: englishPrompt?.substring(0, 100) + '...',
      gcsUri: process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI ? 'configured' : 'not configured'
    });

    if (!englishPrompt) {
      Logger.warn('Video generation request missing English prompt', { route });
      return NextResponse.json(
        { error: 'English prompt is required' },
        { status: 400 }
      );
    }

    Logger.step('Starting video generation with Veo', { 
      promptLength: englishPrompt.length,
      preview: englishPrompt.substring(0, 100) + '...',
      outputUri: process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI
    });

    const videos = await VideoGenerationService.generateVideo(
      englishPrompt,
      process.env.GOOGLE_CLOUD_OUTPUT_GCS_URI
    );

    const duration = Date.now() - startTime;
    const responseData = { videos, success: true };

    Logger.apiSuccess(route, duration, {
      videoCount: videos?.length || 0,
      hasVideos: videos && videos.length > 0 ? 'yes' : 'no',
      totalDuration: `${duration}ms`
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Video generation failed' },
      { status: 500 }
    );
  }
} 