import { useState, useCallback } from 'react';
import { VideoGenerationResult, VideoGenerationState } from '@/types';
import { Logger } from '@/lib/logger';

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    results: [],
    isLoading: false,
    error: null,
  });

  const generateVideo = useCallback(async (koreanPrompt: string) => {
    const startTime = Date.now();
    const id = Date.now().toString();
    
    Logger.info('Client - Starting video generation workflow', {
      requestId: id,
      koreanPrompt: koreanPrompt.substring(0, 100) + '...',
      promptLength: koreanPrompt.length
    });

    const newResult: VideoGenerationResult = {
      id,
      koreanPrompt,
      englishPrompt: '',
      status: 'pending',
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      results: [...prev.results, newResult],
      isLoading: true,
      error: null,
    }));

    try {
      // Step 1: Translate Korean to English
      Logger.step('Client - Starting translation step', {
        requestId: id,
        step: '1/2',
        action: 'translate'
      });

      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id ? { ...result, status: 'translating' } : result
        ),
      }));

      const translationResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ koreanText: koreanPrompt }),
      });

      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        Logger.error('Client - Translation API failed', {
          requestId: id,
          status: translationResponse.status,
          statusText: translationResponse.statusText,
          error: errorText
        });
        throw new Error(`Translation failed: ${translationResponse.status}`);
      }

      const { englishText } = await translationResponse.json();
      Logger.step('Client - Translation completed', {
        requestId: id,
        englishText: englishText.substring(0, 100) + '...',
        translatedLength: englishText.length
      });

      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id 
            ? { ...result, englishPrompt: englishText, status: 'generating' }
            : result
        ),
      }));

      // Step 2: Generate video
      Logger.step('Client - Starting video generation step', {
        requestId: id,
        step: '2/2',
        action: 'generate-video'
      });

      const videoResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ englishPrompt: englishText }),
      });

      if (!videoResponse.ok) {
        const errorText = await videoResponse.text();
        Logger.error('Client - Video generation API failed', {
          requestId: id,
          status: videoResponse.status,
          statusText: videoResponse.statusText,
          error: errorText
        });
        throw new Error(`Video generation failed: ${videoResponse.status}`);
      }

      const { videos } = await videoResponse.json();
      const duration = Date.now() - startTime;

      Logger.info('Client - Video generation workflow completed', {
        requestId: id,
        totalDuration: `${duration}ms`,
        videoCount: videos?.length || 0,
        success: true
      });

      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id
            ? {
                ...result,
                status: 'completed',
                videoUrl: videos[0]?.uri || videos[0]?.url || '',
                completedAt: new Date(),
              }
            : result
        ),
        isLoading: false,
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      Logger.error('Client - Video generation workflow failed', {
        requestId: id,
        totalDuration: `${duration}ms`,
        error: errorMessage,
        success: false
      });

      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id
            ? {
                ...result,
                status: 'error',
                error: errorMessage,
              }
            : result
        ),
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const clearResults = useCallback(() => {
    setState({
      results: [],
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    generateVideo,
    clearResults,
  };
} 