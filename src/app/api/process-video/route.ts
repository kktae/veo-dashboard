import { NextRequest, NextResponse } from 'next/server';
import { downloadAndProcessVideo } from '@/lib/video-server-utils';
import { updateVideoRecord } from '@/lib/database';
import { syncNewVideo } from '@/lib/video-sync';
import { validateResolution } from '@/lib/video-utils';
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

    // Update database with GCS URI and processing results (해상도 값 검증 후 저장)
    Logger.step('Updating database with GCS URI and processing results', { videoId });
    
    const validResolution = validateResolution(result.resolution, videoId);
    
    if (result.resolution && !validResolution) {
      Logger.warn('Invalid resolution from video processing result, not saving to DB', {
        videoId,
        invalidResolution: result.resolution
      });
    }
    
    await updateVideoRecord(videoId, {
      gcs_uri: gcsUri,
      video_url: result.videoUrl,
      thumbnail_url: result.thumbnailUrl,
      duration: result.duration,
      resolution: validResolution, // 검증된 해상도만 저장
      status: 'completed',
      completed_at: new Date().toISOString()
    });

    // Sync the newly processed video to the sync service
    Logger.step('Registering video with sync service', { videoId, gcsUri });
    try {
      await syncNewVideo(videoId, gcsUri);
    } catch (syncError) {
      Logger.warn('Failed to register video with sync service', { 
        videoId, 
        gcsUri, 
        error: syncError instanceof Error ? syncError.message : syncError 
      });
      // Don't fail the whole request if sync registration fails
    }

    const duration = Date.now() - startTime;
    const responseData = { ...result, success: true, gcsUri };

    Logger.apiSuccess(route, duration, {
      videoId,
      gcsUri: gcsUri.substring(0, 50) + '...',
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