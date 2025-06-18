import { NextRequest, NextResponse } from 'next/server';
import { TranslationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/translate';
  
  try {
    const { koreanText } = await request.json();

    Logger.apiStart(route, { koreanText: koreanText?.substring(0, 100) + '...' });

    if (!koreanText) {
      Logger.warn('Translation request missing Korean text', { route });
      return NextResponse.json(
        { error: 'Korean text is required' },
        { status: 400 }
      );
    }

    Logger.step('Starting Korean to English translation', { 
      textLength: koreanText.length,
      preview: koreanText.substring(0, 50) + '...'
    });

    const englishText = await TranslationService.translateKoreanToEnglish(koreanText);

    const duration = Date.now() - startTime;
    const responseData = { koreanText, englishText };

    Logger.apiSuccess(route, duration, {
      englishText: englishText?.substring(0, 100) + '...',
      originalLength: koreanText.length,
      translatedLength: englishText?.length || 0
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