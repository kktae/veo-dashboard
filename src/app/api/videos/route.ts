import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, VideoRecord } from '@/lib/database';
import { Logger } from '@/lib/logger';

// GET /api/videos - Get all videos with pagination
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as VideoRecord['status'] | null;

    Logger.apiStart(route, { limit, offset, status });

    const db = getDatabase();
    let videos: VideoRecord[];

    if (status) {
      videos = db.getVideosByStatus(status);
    } else {
      videos = db.getVideos(limit, offset);
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { 
      videoCount: videos.length,
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
    const { id, korean_prompt, english_prompt, status } = body;

    Logger.apiStart(route, { 
      id, 
      korean_prompt: korean_prompt?.substring(0, 50) + '...',
      status 
    });

    if (!id || !korean_prompt) {
      Logger.warn('Video creation request missing required fields', { 
        route, 
        hasId: !!id, 
        hasKoreanPrompt: !!korean_prompt 
      });
      return NextResponse.json(
        { error: 'ID and Korean prompt are required' },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getDatabase();
      Logger.step('Database instance obtained', { route });
    } catch (dbError) {
      Logger.error('Failed to get database instance', {
        route,
        error: dbError instanceof Error ? dbError.message : dbError,
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      throw new Error('Database connection failed');
    }

    const videoRecord = db.insertVideo({
      id,
      korean_prompt,
      english_prompt: english_prompt || '',
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

// DELETE /api/videos - Clear all videos
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos';
  
  try {
    Logger.apiStart(route, { action: 'clear_all' });

    const db = getDatabase();
    const deletedCount = db.clearAllVideos();

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { deletedCount });

    return NextResponse.json({ 
      message: 'All videos cleared', 
      deletedCount 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to clear videos' },
      { status: 500 }
    );
  }
} 