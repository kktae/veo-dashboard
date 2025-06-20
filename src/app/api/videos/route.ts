import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, VideoRecord } from '@/lib/database';
import { initializeVideoSync } from '@/lib/video-sync';
import { Logger } from '@/lib/logger';

// 초기화 상태 추적
let isVideoSyncInitialized = false;

// GET /api/videos - Get all videos with pagination
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';
  
  try {
    // 최초 API 호출 시 비디오 동기화 서비스 초기화
    if (!isVideoSyncInitialized) {
      Logger.step('Initializing video sync service on first API call');
      initializeVideoSync().catch(error => {
        Logger.warn('Failed to initialize video sync service', {
          error: error instanceof Error ? error.message : error
        });
      });
      isVideoSyncInitialized = true;
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as VideoRecord['status'] | null;

    Logger.apiStart(route, { ids: idsParam, limit, offset, status });

    const db = await getDatabase();
    let videos: VideoRecord[];

    if (idsParam) {
      const ids = idsParam.split(',');
      videos = await db.getVideosByIds(ids);
    } else if (status) {
      videos = await db.getVideosByStatus(status);
    } else {
      videos = await db.getVideos(limit, offset);
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { 
      videoCount: videos.length,
      hasIds: !!idsParam,
      hasStatus: !!status 
    });

    return NextResponse.json({
      videos,
      count: videos.length,
      limit,
      offset
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

// POST /api/videos - Create new video record
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';
  
  try {
    const body = await request.json();
    const { id, korean_prompt, english_prompt, user_email, status } = body;

    Logger.apiStart(route, { 
      id, 
      korean_prompt: korean_prompt?.substring(0, 50) + '...',
      user_email,
      status 
    });

    if (!id || !korean_prompt || !user_email) {
      Logger.warn('Video creation request missing required fields', { 
        route, 
        hasId: !!id, 
        hasKoreanPrompt: !!korean_prompt,
        hasUserEmail: !!user_email
      });
      return NextResponse.json(
        { error: 'ID, Korean prompt, and user email are required' },
        { status: 400 }
      );
    }

    let db;
    try {
      db = await getDatabase();
      Logger.step('Database instance obtained', { route });
    } catch (dbError) {
      Logger.error('Failed to get database instance', {
        route,
        error: dbError instanceof Error ? dbError.message : dbError,
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      throw new Error('Database connection failed');
    }

    const videoRecord = await db.insertVideo({
      id,
      korean_prompt,
      english_prompt: english_prompt || '',
      user_email,
      status: status || 'pending'
    });

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { id: videoRecord.id });

    return NextResponse.json(videoRecord, { status: 201 });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create video record',
        details: errorMessage,
        code: 'VIDEO_CREATE_FAILED'
      },
      { status: 500 }
    );
  }
}

// PATCH /api/videos - Update video record
export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';
  
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    Logger.apiStart(route, { 
      id, 
      updateFields: Object.keys(updates)
    });

    if (!id) {
      Logger.warn('Video update request missing ID', { route });
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const videoRecord = await db.updateVideo(id, updates);

    if (!videoRecord) {
      Logger.warn('Video record not found for update', { route, id });
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { id: videoRecord.id });

    return NextResponse.json(videoRecord);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to update video record' },
      { status: 500 }
    );
  }
}

// DELETE /api/videos - Clear all videos or specific videos
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      Logger.warn('DELETE request with empty or invalid JSON body', { route });
      return NextResponse.json({ error: '잘못된 요청입니다. 삭제 키가 필요합니다.' }, { status: 400 });
    }
    
    const { deleteKey, videoIds, deleteAll } = body;
    const adminKey = process.env.ADMIN_DELETE_KEY;

    if (!adminKey) {
      const message = 'ADMIN_DELETE_KEY is not configured on the server.';
      Logger.error(message, { route });
      return NextResponse.json({ error: '서버가 삭제 기능을 사용하도록 구성되지 않았습니다.' }, { status: 500 });
    }

    if (deleteKey !== adminKey) {
      Logger.warn('Invalid delete key provided for bulk delete', { route });
      return NextResponse.json({ error: '잘못된 삭제 키입니다.' }, { status: 403 });
    }

    const db = await getDatabase();

    if (deleteAll) {
      Logger.apiStart(route, { action: 'deleteAll' });
      const count = await db.clearAllVideos();
      const duration = Date.now() - startTime;
      Logger.apiSuccess(route, duration, { action: 'deleteAll', deletedCount: count });
      return NextResponse.json({ message: `Successfully deleted ${count} videos.` });
    }

    if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
      Logger.apiStart(route, { action: 'deleteSelected', count: videoIds.length });
      const count = await db.deleteVideos(videoIds);
      const duration = Date.now() - startTime;
      Logger.apiSuccess(route, duration, { action: 'deleteSelected', deletedCount: count });
      return NextResponse.json({ message: `Successfully deleted ${count} videos.` });
    }

    Logger.warn('Invalid delete request. Missing deleteAll flag or videoIds array.', { route, body });
    return NextResponse.json({ error: '잘못된 삭제 요청입니다. 삭제할 대상을 지정해야 합니다.' }, { status: 400 });

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to delete videos' },
      { status: 500 }
    );
  }
} 