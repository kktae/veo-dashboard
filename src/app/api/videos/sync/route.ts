import { NextRequest, NextResponse } from 'next/server';
import { getVideoSyncStatus, initializeVideoSync, syncNewVideo } from '@/lib/video-sync';
import { Logger } from '@/lib/logger';

// GET /api/videos/sync - 비디오 동기화 상태 조회
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos/sync';
  
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    
    Logger.step('API - Getting video sync status', { route, videoId });
    
    const syncStatus = getVideoSyncStatus(videoId || undefined);
    
    const duration = Date.now() - startTime;
    Logger.step('API - Video sync status retrieved successfully', {
      route,
      duration,
      statusCount: Array.isArray(syncStatus) ? syncStatus.length : 1
    });
    
    return NextResponse.json({
      success: true,
      data: syncStatus
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error('API - Failed to get video sync status', {
      route,
      duration,
      error: error instanceof Error ? error.message : error
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// POST /api/videos/sync - 비디오 동기화 서비스 초기화 또는 특정 비디오 동기화
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos/sync';
  
  try {
    const body = await request.json();
    const { action, videoId, gcsUri } = body;
    
    Logger.step('API - Processing video sync request', { 
      route, 
      action, 
      videoId,
      hasGcsUri: !!gcsUri 
    });
    
    if (action === 'initialize') {
      // 비디오 동기화 서비스 초기화
      await initializeVideoSync();
      
      const duration = Date.now() - startTime;
      Logger.step('API - Video sync service initialized', {
        route,
        duration
      });
      
      return NextResponse.json({
        success: true,
        message: 'Video sync service initialized successfully'
      });
      
    } else if (action === 'sync' && videoId && gcsUri) {
      // 특정 비디오 동기화
      await syncNewVideo(videoId, gcsUri);
      
      const duration = Date.now() - startTime;
      Logger.step('API - Video synced successfully', {
        route,
        videoId,
        duration
      });
      
      return NextResponse.json({
        success: true,
        message: `Video ${videoId} synced successfully`
      });
      
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action or missing required parameters. Use action="initialize" or action="sync" with videoId and gcsUri.'
        },
        { status: 400 }
      );
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error('API - Failed to process video sync request', {
      route,
      duration,
      error: error instanceof Error ? error.message : error
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 