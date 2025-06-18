import { NextRequest, NextResponse } from 'next/server';
import { downloadAndProcessVideo } from '@/lib/video-utils';
import { Logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/process-video';
  
  try {
    const { gcsUri, videoId } = await request.json();

    Logger.apiStart(route, { 
      gcsUri: gcsUri?.substring(0, 50) + '...',
      videoId
    });

    if (!gcsUri || !videoId) {
      Logger.warn('Video processing request missing required parameters', { route, gcsUri: !!gcsUri, videoId: !!videoId });
      return NextResponse.json(
        { error: 'GCS URI and video ID are required' },
        { status: 400 }
      );
    }

    Logger.step('Starting video download and processing', { 
      videoId,
      gcsUri: gcsUri.substring(0, 50) + '...'
    });

    const result = await downloadAndProcessVideo(gcsUri, videoId);

    const duration = Date.now() - startTime;
    const responseData = { ...result, success: true };

    Logger.apiSuccess(route, duration, {
      videoId,
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
      duration: result.duration,
      resolution: result.resolution,
      totalDuration: `${duration}ms`
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Video processing failed' },
      { status: 500 }
    );
  }
} 