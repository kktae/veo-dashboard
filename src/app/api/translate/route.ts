import { NextRequest, NextResponse } from 'next/server';
import { TranslationService } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { TranslationPromptConfig } from '@/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/translate';
  
  try {
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

    if (!koreanText) {
      Logger.warn('Translation request missing Korean text', { route });
      return NextResponse.json(
        { error: 'Korean text is required' },
        { status: 400 }
      );
    }

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