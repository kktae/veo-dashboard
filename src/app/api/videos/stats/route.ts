import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { Logger } from '@/lib/logger';

// GET /api/videos/stats - Get database statistics
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/videos/stats';
  
  try {
    Logger.apiStart(route, {});

    const db = getDatabase();
    const stats = db.getStats();

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, stats);

    return NextResponse.json(stats);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
} 