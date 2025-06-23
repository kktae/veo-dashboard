import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { Logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/videos/[id] - Get single video record
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { id } = await params;
  const route = `/api/videos/${id}`;
  
  try {
    Logger.apiStart(route, { id });

    const db = await getDatabase();
    const video = await db.getVideo(id);

    if (!video) {
      Logger.warn('Video record not found', { route, id });
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { id: video.id, status: video.status });

    return NextResponse.json(video);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}

// PUT /api/videos/[id] - Update video record
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { id } = await params;
  const route = `/api/videos/${id}`;
  
  try {
    const updates = await request.json();

    Logger.apiStart(route, { 
      id,
      updateFields: Object.keys(updates)
    });

    const db = await getDatabase();
    const updatedVideo = await db.updateVideo(id, updates);

    if (!updatedVideo) {
      Logger.warn('Video record not found for update', { route, id });
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { 
      id: updatedVideo.id, 
      status: updatedVideo.status 
    });

    return NextResponse.json(updatedVideo);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to update video' },
      { status: 500 }
    );
  }
}

// DELETE /api/videos/[id] - Delete video record
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { id } = await params;
  const route = `/api/videos/${id}`;
  
  try {
    const { deleteKey } = await request.json();
    const adminKey = process.env.ADMIN_SECRET_KEY;

    if (!adminKey) {
      const message = 'ADMIN_SECRET_KEY is not configured on the server.';
      Logger.error(message, { route, id });
      return NextResponse.json(
        { error: 'Server is not configured for deletions.' },
        { status: 500 }
      );
    }

    if (deleteKey !== adminKey) {
      Logger.warn('Invalid delete key provided', { route, id });
      return NextResponse.json(
        { error: '잘못된 삭제 키입니다.' },
        { status: 403 }
      );
    }

    Logger.apiStart(route, { id });

    const db = await getDatabase();
    const deletedVideo = await db.deleteVideo(id);

    if (!deletedVideo) {
      Logger.warn('Video record not found for deletion', { route, id });
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, { id });

    return NextResponse.json({ 
      message: 'Video deleted successfully',
      id 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error instanceof SyntaxError) {
      Logger.warn('DELETE request with empty or invalid JSON body', { route, id });
      return NextResponse.json({ error: '삭제 키가 필요합니다.' }, { status: 400 });
    }
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    );
  }
} 