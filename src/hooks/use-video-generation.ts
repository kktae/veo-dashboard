import { useState, useCallback, useEffect } from 'react';
import { VideoGenerationResult, VideoGenerationState } from '@/types';
import { Logger } from '@/lib/logger';

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    results: [],
    isLoading: false,
    error: null,
    selectedIds: [],
  });
  
  // Add separate state for initial loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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
          
          Logger.info('Client - Videos loaded from database', { count: results.length });
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
  }, []);

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

    try {
      // Step 1: Translate Korean to English
      Logger.step('Client - Starting translation step', {
        requestId: id,
        step: '1/2',
        action: 'translate'
      });

      // Update state and database for translating status
      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id ? { ...result, status: 'translating' } : result
        ),
      }));

      // Update database record
      await fetch(`/api/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'translating' }),
      });

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

      // Update state and database with translation result
      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id 
            ? { ...result, englishPrompt: englishText, status: 'generating' }
            : result
        ),
      }));

      // Update database with translation
      await fetch(`/api/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          english_prompt: englishText,
          status: 'generating' 
        }),
      });

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
      
      if (!videos || videos.length === 0) {
        throw new Error('No videos generated from API');
      }

      const generatedVideo = videos[0];
      const gcsUri = generatedVideo?.video?.uri;
      
      if (!gcsUri) {
        throw new Error('No video URI returned from generation API');
      }

      // Update state to processing
      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id
            ? { ...result, status: 'processing' }
            : result
        ),
      }));

      // Update database status to processing
      await fetch(`/api/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'processing'
        }),
      });

      Logger.step('Client - Video generation completed, starting download and processing', {
        requestId: id,
        gcsUri: gcsUri.substring(0, 50) + '...',
        step: '3/3',
        action: 'process-video'
      });

      // Step 3: Download and process video
      const processResponse = await fetch('/api/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gcsUri: gcsUri,
          videoId: id
        }),
      });

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        Logger.error('Client - Video processing API failed', {
          requestId: id,
          status: processResponse.status,
          statusText: processResponse.statusText,
          error: errorText
        });
        throw new Error(`Video processing failed: ${processResponse.status}`);
      }

      const processResult = await processResponse.json();
      const duration = Date.now() - startTime;

      Logger.info('Client - Complete video workflow finished successfully', {
        requestId: id,
        totalDuration: `${duration}ms`,
        videoUrl: processResult.videoUrl,
        thumbnailUrl: processResult.thumbnailUrl,
        actualDuration: processResult.duration,
        resolution: processResult.resolution,
        success: true
      });

      const completedResult = {
        status: 'completed' as const,
        videoUrl: processResult.videoUrl,
        thumbnailUrl: processResult.thumbnailUrl,
        duration: processResult.duration || 8,
        resolution: processResult.resolution || '1920x1080',
        completedAt: new Date(),
      };

      setState(prev => ({
        ...prev,
        results: prev.results.map(result =>
          result.id === id
            ? { ...result, ...completedResult }
            : result
        ),
        isLoading: false,
      }));

      // Update database with final result
      await fetch(`/api/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: completedResult.status,
          video_url: completedResult.videoUrl,
          thumbnail_url: completedResult.thumbnailUrl,
          duration: completedResult.duration,
          resolution: completedResult.resolution,
          completed_at: completedResult.completedAt.toISOString(),
        }),
      });
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
  }, []);

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