import { NextRequest, NextResponse } from 'next/server';
import { TranslationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { TranslationPromptConfig } from '@/types';
import { isVideoGenerationEnabled } from '@/lib/database';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/translate';
  
  try {
    // 1. 가장 먼저 비디오 생성 기능 활성화 상태 확인
    const isGenerationEnabled = await isVideoGenerationEnabled();
    if (!isGenerationEnabled) {
      Logger.warn('Translation blocked - video generation is currently disabled by admin', { route });
      return NextResponse.json(
        { error: 'Video generation is currently disabled. Please contact admin.' },
        { status: 503 }
      );
    }

    // 2. 요청 데이터 파싱
    const { 
      koreanText, 
      model = 'gemini-2.0-flash-lite-001',
      promptConfig 
    } = await request.json();

    Logger.apiStart(route, { 
      koreanText: koreanText?.substring(0, 100) + '...',
      model,
      hasCustomPromptConfig: !!promptConfig
    });

    // 3. 필수 파라미터 검증
    if (!koreanText) {
      Logger.warn('Translation request missing Korean text', { route });
      return NextResponse.json(
        { error: 'Korean text is required' },
        { status: 400 }
      );
    }

    // 4. 번역 프로세스 시작
    Logger.step('Starting Korean to English translation', { 
      textLength: koreanText.length,
      preview: koreanText.substring(0, 50) + '...',
      model,
      systemInstruction: promptConfig?.systemInstruction?.substring(0, 50) || 'default',
      userPromptTemplate: promptConfig?.userPromptTemplate?.substring(0, 50) || 'default'
    });

    const englishText = await TranslationService.translateKoreanToEnglish(
      koreanText, 
      model,
      promptConfig as TranslationPromptConfig
    );

    const duration = Date.now() - startTime;
    const responseData = { koreanText, englishText, model, promptConfig };

    Logger.apiSuccess(route, duration, {
      englishText: englishText?.substring(0, 100) + '...',
      originalLength: koreanText.length,
      translatedLength: englishText?.length || 0,
      model
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
} 