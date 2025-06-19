import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoGenerationResult, VideoGenerationState, AIModelConfig } from '@/types';
import { Logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    results: [],
    isLoading: false,
    error: null,
    selectedIds: [],
  });
  
  // Add separate state for initial loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing videos from database on mount
  useEffect(() => {
    const loadVideos = async () => {
      try {
        setIsInitialLoading(true);
        Logger.info('Client - Loading videos from database');
        
        const response = await fetch('/api/videos');
        if (response.ok) {
          const data = await response.json();
          const videos = data.videos || [];
          
          // Convert database records to VideoGenerationResult format
          const results: VideoGenerationResult[] = videos.map((video: any) => ({
            id: video.id,
            koreanPrompt: video.korean_prompt,
            englishPrompt: video.english_prompt,
            status: video.status,
            videoUrl: video.video_url || undefined,
            thumbnailUrl: video.thumbnail_url || undefined,
            duration: video.duration || undefined,
            resolution: video.resolution || undefined,
            error: video.error_message || undefined,
            createdAt: new Date(video.created_at),
            completedAt: video.completed_at ? new Date(video.completed_at) : undefined,
          }));
          
          setState(prev => ({
            ...prev,
            results: results
          }));
          
          // Check if there are any videos in progress and start polling
          const hasProgressingVideos = results.some(result => 
            ['pending', 'translating', 'generating', 'processing'].includes(result.status)
          );
          
          if (hasProgressingVideos) {
            startPolling();
          }
          
          Logger.info('Client - Videos loaded from database', { 
            count: results.length,
            progressingCount: results.filter(r => ['pending', 'translating', 'generating', 'processing'].includes(r.status)).length
          });
        }
      } catch (error) {
        Logger.error('Client - Failed to load videos from database', {
          error: error instanceof Error ? error.message : error
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadVideos();

    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Polling function to check status of progressing videos
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/videos');
        if (response.ok) {
          const data = await response.json();
          const videos = data.videos || [];
          
          const results: VideoGenerationResult[] = videos.map((video: any) => ({
            id: video.id,
            koreanPrompt: video.korean_prompt,
            englishPrompt: video.english_prompt,
            status: video.status,
            videoUrl: video.video_url || undefined,
            thumbnailUrl: video.thumbnail_url || undefined,
            duration: video.duration || undefined,
            resolution: video.resolution || undefined,
            error: video.error_message || undefined,
            createdAt: new Date(video.created_at),
            completedAt: video.completed_at ? new Date(video.completed_at) : undefined,
          }));
          
          setState(prev => ({
            ...prev,
            results: results
          }));
          
          // Stop polling if no videos are in progress
          const hasProgressingVideos = results.some(result => 
            ['pending', 'translating', 'generating', 'processing'].includes(result.status)
          );
          
          if (!hasProgressingVideos && pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            Logger.info('Client - Stopped polling, no videos in progress');
          }
        }
      } catch (error) {
        Logger.error('Client - Polling error', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, 3000); // Poll every 3 seconds

    Logger.info('Client - Started polling for video status updates');
  }, []);

  const generateVideo = useCallback(async (koreanPrompt: string, config: AIModelConfig) => {
    const startTime = Date.now();
    const id = uuidv4();
    
    Logger.info('Client - Starting video generation workflow', {
      requestId: id,
      koreanPrompt: koreanPrompt.substring(0, 100) + '...',
      promptLength: koreanPrompt.length,
      translationModel: config.translationModel,
      videoGenerationModel: config.videoGenerationModel,
      hasCustomPromptConfig: config.translationPromptConfig ? 'yes' : 'no'
    });

    const newResult: VideoGenerationResult = {
      id,
      koreanPrompt,
      englishPrompt: '',
      status: 'pending',
      createdAt: new Date(),
    };

    // Save initial record to database
    try {
      const saveResponse = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newResult.id,
          korean_prompt: newResult.koreanPrompt,
          english_prompt: newResult.englishPrompt,
          status: newResult.status
        }),
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        Logger.error('Client - Database save failed', {
          requestId: id,
          status: saveResponse.status,
          statusText: saveResponse.statusText,
          error: errorText
        });
        throw new Error(`Database save failed: ${saveResponse.status} - ${errorText}`);
      }

      Logger.step('Client - Initial video record saved to database', { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      Logger.error('Client - Failed to save initial video record', {
        requestId: id,
        error: errorMessage
      });
      
      // Set error state and return early - don't continue with the process
      setState(prev => ({
        ...prev,
        results: [...prev.results, { ...newResult, status: 'error', error: errorMessage }],
        isLoading: false,
        error: errorMessage,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      results: [...prev.results, newResult],
      isLoading: true,
      error: null,
    }));

    // Start polling to track progress
    startPolling();

    try {
      // Step 1: Translate Korean to English
      Logger.step('Client - Starting translation step', {
        requestId: id,
        step: '1/3',
        action: 'translate',
        translationModel: config.translationModel
      });

      const translationResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          koreanText: koreanPrompt,
          model: config.translationModel,
          promptConfig: config.translationPromptConfig
        }),
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

      // Step 2: Start video generation (async)
      Logger.step('Client - Starting video generation step', {
        requestId: id,
        step: '2/3',
        action: 'generate-video',
        videoGenerationModel: config.videoGenerationModel
      });

      const videoResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          englishPrompt: englishText,
          videoId: id,
          model: config.videoGenerationModel
        }),
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

      const { success, status } = await videoResponse.json();
      
      if (!success) {
        throw new Error('Video generation failed to start');
      }

      Logger.info('Client - Video generation started successfully', {
        requestId: id,
        status,
        message: 'Video generation is now running in background'
      });

      setState(prev => ({
        ...prev,
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

      // Update database with error
      try {
        await fetch(`/api/videos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'error',
            error_message: errorMessage,
          }),
        });
      } catch (dbError) {
        Logger.error('Client - Failed to update database with error', {
          requestId: id,
          dbError: dbError instanceof Error ? dbError.message : dbError
        });
      }
    }
  }, [startPolling]);

  const clearResults = useCallback(async () => {
    try {
      Logger.info('Client - Clearing all video results');
      
      // Clear from database first
      const response = await fetch('/api/videos', {
        method: 'DELETE',
      });

      if (response.ok) {
        // Clear local state only after successful database operation
        setState({
          results: [],
          isLoading: false,
          error: null,
          selectedIds: [],
        });
        
        Logger.info('Client - All video results cleared successfully');
      } else {
        throw new Error('Failed to clear videos from database');
      }
    } catch (error) {
      Logger.error('Client - Failed to clear video results', {
        error: error instanceof Error ? error.message : error
      });
      
      // Still clear local state even if database operation failed
      setState({
        results: [],
        isLoading: false,
        error: null,
        selectedIds: [],
      });
    }
  }, []);

  const toggleVideoSelection = useCallback((videoId: string) => {
    setState(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(videoId)
        ? prev.selectedIds.filter(id => id !== videoId)
        : [...prev.selectedIds, videoId]
    }));
  }, []);

  const selectAllVideos = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: prev.results.map(result => result.id)
    }));
  }, []);

  const deselectAllVideos = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: []
    }));
  }, []);

  const deleteSelectedVideos = useCallback(async () => {
    const { selectedIds } = state;
    if (selectedIds.length === 0) return;

    try {
      Logger.info('Client - Deleting selected videos', { count: selectedIds.length });

      // Delete videos from database in parallel
      const deletePromises = selectedIds.map(async (id) => {
        const response = await fetch(`/api/videos/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete video ${id}: ${response.status}`);
        }

        return id;
      });

      const deletedIds = await Promise.all(deletePromises);

      // Update local state to remove deleted videos
      setState(prev => ({
        ...prev,
        results: prev.results.filter(result => !deletedIds.includes(result.id)),
        selectedIds: [],
      }));

      Logger.info('Client - Selected videos deleted successfully', { 
        deletedCount: deletedIds.length 
      });
    } catch (error) {
      Logger.error('Client - Failed to delete selected videos', {
        error: error instanceof Error ? error.message : error
      });
      
      // Optionally show error to user
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete selected videos',
      }));
    }
  }, [state.selectedIds]);

  return {
    ...state,
    isInitialLoading,
    generateVideo,
    clearResults,
    toggleVideoSelection,
    selectAllVideos,
    deselectAllVideos,
    deleteSelectedVideos,
  };
} 