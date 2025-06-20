import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoGenerationResult, VideoGenerationState, AIModelConfig } from '@/types';
import { Logger } from '@/lib/logger';
import { convertDatabaseRecordToResult } from '@/lib/video-utils';
import { isProgressingStatus } from '@/lib/constants';
import { API_CONFIG } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';

// Custom hook for managing video API requests
const useVideoApi = () => {
  const fetchVideos = useCallback(async (): Promise<VideoGenerationResult[]> => {
    const response = await fetch('/api/videos');
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.status}`);
    }
    
    const data = await response.json();
    const videos = data.videos || [];
    
    return videos.map((video: any) => convertDatabaseRecordToResult(video));
  }, []);

  const createVideo = useCallback(async (videoData: {
    id: string;
    korean_prompt: string;
    english_prompt: string;
    user_email: string;
    status: string;
  }) => {
    const response = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database save failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }, []);

     const deleteVideos = useCallback(async (videoIds: string[]) => {
     const promises = videoIds.map(id => 
       fetch(`/api/videos/${id}`, { method: 'DELETE' })
     );
     const responses = await Promise.all(promises);
     
     // Check if all deletions were successful
     responses.forEach((response, index) => {
       if (!response.ok) {
         throw new Error(`Failed to delete video ${videoIds[index]}: ${response.status}`);
       }
     });
   }, []);

  const clearAllVideos = useCallback(async () => {
    const response = await fetch('/api/videos', { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to clear videos');
    }
    return response.json();
  }, []);

  return { fetchVideos, createVideo, deleteVideos, clearAllVideos };
};

// Custom hook for video polling
const useVideoPolling = (
  onUpdate: (videos: VideoGenerationResult[]) => void,
  shouldPoll: boolean
) => {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { fetchVideos } = useVideoApi();

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const videos = await fetchVideos();
        onUpdate(videos);
        
        // Stop polling if no videos are in progress
        const hasProgressingVideos = videos.some(video => 
          isProgressingStatus(video.status)
        );
        
        if (!hasProgressingVideos && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          Logger.info('Client - Stopped polling, no videos in progress');
        }
      } catch (error) {
        Logger.error('Client - Polling error', {
          error: error instanceof Error ? error.message : error
        });
      }
    }, API_CONFIG.POLLING_INTERVAL);

    Logger.info('Client - Started polling for video status updates');
  }, [fetchVideos, onUpdate]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [shouldPoll, startPolling, stopPolling]);

  return { startPolling, stopPolling };
};

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    results: [],
    isLoading: false,
    error: null,
    selectedIds: [],
  });
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { fetchVideos, createVideo, deleteVideos, clearAllVideos } = useVideoApi();

  // Handle video updates from polling
  const handleVideoUpdate = useCallback((videos: VideoGenerationResult[]) => {
    setState(prev => ({
      ...prev,
      results: videos
    }));
  }, []);

  // Determine if polling should be active
  const shouldPoll = state.results.some(result => isProgressingStatus(result.status));

  // Use polling hook
  useVideoPolling(handleVideoUpdate, shouldPoll);

  // Load existing videos from database on mount
  useEffect(() => {
    const loadVideos = async () => {
      try {
        setIsInitialLoading(true);
        Logger.info('Client - Loading videos from database');
        
        const results = await fetchVideos();
        
        setState(prev => ({
          ...prev,
          results: results
        }));
        
        Logger.info('Client - Videos loaded from database', { 
          count: results.length,
          progressingCount: results.filter(r => isProgressingStatus(r.status)).length
        });
      } catch (error) {
        Logger.error('Client - Failed to load videos from database', {
          error: error instanceof Error ? error.message : error
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadVideos();
  }, [fetchVideos]);

  const generateVideo = useCallback(async (koreanPrompt: string, config: AIModelConfig, userEmail: string) => {
    const startTime = Date.now();
    const id = uuidv4();
    
    Logger.info('Client - Starting video generation workflow', {
      requestId: id,
      koreanPrompt: koreanPrompt.substring(0, 100) + '...',
      promptLength: koreanPrompt.length,
      userEmail: userEmail,
      translationModel: config.translationModel,
      videoGenerationModel: config.videoGenerationModel,
      hasCustomPromptConfig: config.translationPromptConfig ? 'yes' : 'no'
    });

    const newResult: VideoGenerationResult = {
      id,
      koreanPrompt,
      englishPrompt: '',
      userEmail,
      status: 'pending',
      createdAt: new Date(),
    };

    // Add to state immediately for UI feedback
    setState(prev => ({
      ...prev,
      results: [newResult, ...prev.results],
      isLoading: true,
      error: null,
    }));

    try {
      // Save initial record to database
      await createVideo({
        id: newResult.id,
        korean_prompt: newResult.koreanPrompt,
        english_prompt: newResult.englishPrompt,
        user_email: userEmail,
        status: newResult.status
      });

      Logger.step('Client - Initial video record saved to database', { id });

      // Start the translation and generation process
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
        throw new Error(`Translation failed: ${translationResponse.status} - ${errorText}`);
      }

      const translationData = await translationResponse.json();
      const englishPrompt = translationData.englishText;

      Logger.step('Client - Translation completed', { 
        id,
        englishPrompt: englishPrompt.substring(0, 100) + '...'
      });

      // Update database with translation
      const updateResponse = await fetch('/api/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          english_prompt: englishPrompt,
          status: 'translating'
        }),
      });

      if (!updateResponse.ok) {
        Logger.warn('Failed to update video record with translation', { id });
      }

      // Update local state with translation
      setState(prev => ({
        ...prev,
        results: prev.results.map(result => 
          result.id === id 
            ? { ...result, englishPrompt, status: 'translating' as const }
            : result
        ),
      }));

      // Start video generation
      const generationResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          englishPrompt,
          videoId: id,
          model: config.videoGenerationModel
        }),
      });

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        throw new Error(`Video generation failed: ${generationResponse.status} - ${errorText}`);
      }

      const generationData = await generationResponse.json();
      
      Logger.step('Client - Video generation started', { 
        id,
        status: generationData.status 
      });

      const duration = Date.now() - startTime;
      Logger.info('Client - Video generation workflow initiated successfully', {
        requestId: id,
        totalDuration: `${duration}ms`,
        translationModel: config.translationModel,
        videoGenerationModel: config.videoGenerationModel
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Client - Video generation workflow failed', {
        requestId: id,
        error: errorMessage,
        duration: Date.now() - startTime
      });
      
      // Update state with error
      setState(prev => ({
        ...prev,
        results: prev.results.map(result => 
          result.id === id 
            ? { ...result, status: 'error' as const, error: errorMessage }
            : result
        ),
        error: errorMessage,
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [createVideo]);

  const clearResults = useCallback(async () => {
    try {
      Logger.info('Client - Clearing all videos');
      await clearAllVideos();
      
      setState(prev => ({
        ...prev,
        results: [],
        selectedIds: [],
        error: null,
      }));
      
      Logger.info('Client - All videos cleared successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear videos';
      Logger.error('Client - Failed to clear videos', { error: errorMessage });
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [clearAllVideos]);

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
      selectedIds: prev.results.map(r => r.id)
    }));
  }, []);

  const deselectAllVideos = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: []
    }));
  }, []);

  const deleteSelectedVideos = useCallback(async () => {
    if (state.selectedIds.length === 0) return;

    try {
      Logger.info('Client - Deleting selected videos', { 
        count: state.selectedIds.length,
        ids: state.selectedIds 
      });
      
      await deleteVideos(state.selectedIds);
      
      setState(prev => ({
        ...prev,
        results: prev.results.filter(result => !prev.selectedIds.includes(result.id)),
        selectedIds: [],
        error: null,
      }));
      
      Logger.info('Client - Selected videos deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete videos';
      Logger.error('Client - Failed to delete selected videos', { error: errorMessage });
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [state.selectedIds, deleteVideos]);

  return {
    results: state.results,
    isLoading: state.isLoading,
    error: state.error,
    selectedIds: state.selectedIds,
    isInitialLoading,
    generateVideo,
    clearResults,
    toggleVideoSelection,
    selectAllVideos,
    deselectAllVideos,
    deleteSelectedVideos
  };
}