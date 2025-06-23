import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { isVideoGenerationEnabled as getVideoGenerationStatus, setVideoGenerationEnabled } from '@/lib/database';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/admin/toggle-feature';
  
  try {
    const { adminKey, action } = await request.json();

    Logger.apiStart(route, { action });

    // 관리자 키 검증
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      Logger.warn('Invalid admin key provided', { route });
      return NextResponse.json(
        { error: 'Invalid admin key' },
        { status: 401 }
      );
    }

    // 액션에 따른 기능 토글
    if (action === 'enable') {
      await setVideoGenerationEnabled(true);
    } else if (action === 'disable') {
      await setVideoGenerationEnabled(false);
    } else if (action === 'status') {
      // 현재 상태만 반환
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "enable", "disable", or "status"' },
        { status: 400 }
      );
    }

    // 현재 상태 가져오기
    const currentStatus = await getVideoGenerationStatus();

    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, {
      action,
      currentStatus
    });

    return NextResponse.json({
      success: true,
      videoGenerationEnabled: currentStatus,
      action: action === 'status' ? 'checked' : action
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to toggle feature' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const startTime = Date.now();
  const route = '/api/admin/toggle-feature';
  
  try {
    Logger.apiStart(route, { action: 'get-status' });
    
    const currentStatus = await getVideoGenerationStatus();
    
    const duration = Date.now() - startTime;
    Logger.apiSuccess(route, duration, {
      currentStatus
    });

    return NextResponse.json({
      videoGenerationEnabled: currentStatus
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to get feature status' },
      { status: 500 }
    );
  }
}

// 다른 API에서 사용할 수 있는 헬퍼 함수
export async function isVideoGenerationAllowed(): Promise<boolean> {
  return await getVideoGenerationStatus();
} 