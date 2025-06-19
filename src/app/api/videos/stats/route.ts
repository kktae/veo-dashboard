import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { Logger } from '@/lib/logger';

// GET /api/videos/stats - Get database statistics
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos/stats';
  
  try {
    Logger.apiStart(route, {});

    const db = await getDatabase();
    const stats = await db.getStats();
    
    // Also get videos by status for more detailed info
    const pendingVideos = await db.getVideosByStatus('pending');
    const translatingVideos = await db.getVideosByStatus('translating');
    const generatingVideos = await db.getVideosByStatus('generating');
    const processingVideos = await db.getVideosByStatus('processing');
    
    const duration = Date.now() - startTime;
    const responseData = {
      ...stats,
      progressingVideos: {
        pending: pendingVideos.length,
        translating: translatingVideos.length,
        generating: generatingVideos.length,
        processing: processingVideos.length,
        total: pendingVideos.length + translatingVideos.length + generatingVideos.length + processingVideos.length
      },
      success: true
    };

    Logger.apiSuccess(route, duration, {
      totalVideos: stats.totalVideos,
      completedVideos: stats.completedVideos,
      errorVideos: stats.errorVideos,
      progressingTotal: responseData.progressingVideos.total,
      totalDuration: `${duration}ms`
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to get video statistics' },
      { status: 500 }
    );
  }
} 