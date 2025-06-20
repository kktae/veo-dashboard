import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { VideoGenerationResult, VideoGenerationState, AIModelConfig } from '@/types';
import { Logger } from '@/lib/logger';
import { convertDatabaseRecordToResult } from '@/lib/video-utils';
import { isProgressingStatus } from '@/lib/constants';
import { API_CONFIG } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';

const VIDEOS_PER_PAGE = 10;

// Custom hook for managing video API requests
const useVideoApi = () => {
  const fetchVideos = useCallback(async (page: number = 0): Promise<{ videos: VideoGenerationResult[], hasMore: boolean }> => {
    const limit = VIDEOS_PER_PAGE;
    const offset = page * limit;
    
    const response = await fetch(`/api/videos?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.status}`);
    }
    
    const data = await response.json();
    const videos = (data.videos || []).map((video: any) => convertDatabaseRecordToResult(video));
    const hasMore = videos.length === limit;
    
    return { videos, hasMore };
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

  const deleteVideos = useCallback(async (videoIds: string[], deleteKey: string) => {
    if (videoIds.length === 0) return;
    
    const response = await fetch('/api/videos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds, deleteKey }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
      throw new Error(errorData.error || `Failed to delete videos: ${response.status}`);
    }
  }, []);

  const clearAllVideos = useCallback(async (deleteKey: string) => {
    const response = await fetch('/api/videos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true, deleteKey }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
      throw new Error(errorData.error || 'Failed to clear videos');
    }
    return response.json();
  }, []);

  return { fetchVideos, createVideo, deleteVideos, clearAllVideos };
};

// Custom hook for video polling
const useVideoPolling = (
  results: VideoGenerationResult[],
  onUpdate: (updatedVideos: VideoGenerationResult[]) => void,
  shouldPoll: boolean
) => {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const poll = useCallback(async () => {
    const progressingVideos = results.filter(video => isProgressingStatus(video.status));
    
    if (progressingVideos.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        Logger.info('Client - Stopped polling, no videos in progress');
      }
      return;
    }
    
    try {
      const idsToPoll = progressingVideos.map(v => v.id).join(',');
      const response = await fetch(`/api/videos?ids=${idsToPoll}`);
      
      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }
      
      const data = await response.json();
      const updatedVideos = (data.videos || []).map(convertDatabaseRecordToResult);
      
      if (updatedVideos.length > 0) {
        onUpdate(updatedVideos);
      }
    } catch (error) {
      Logger.error('Client - Polling error', {
        error: error instanceof Error ? error.message : error
      });
    }
  }, [results, onUpdate]);

  useEffect(() => {
    if (shouldPoll) {
      if (!pollingIntervalRef.current) {
        Logger.info('Client - Started polling for video status updates');
        // Run once immediately
        poll();
        // Then set interval
        pollingIntervalRef.current = setInterval(poll, API_CONFIG.POLLING_INTERVAL);
      }
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        Logger.info('Client - Stopped polling as shouldPoll is false');
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [shouldPoll, poll]);
};

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    results: [],
    isLoading: false,
    error: null,
    selectedIds: [],
  });
  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAppending, setIsAppending] = useState(false);
  const { fetchVideos, createVideo, deleteVideos, clearAllVideos } = useVideoApi();

  // Handle video updates from polling
  const handleVideoUpdate = useCallback((updatedVideos: VideoGenerationResult[]) => {
    setState(prev => {
      const updatedResults = prev.results.map(existingVideo => {
        const updated = updatedVideos.find(v => v.id === existingVideo.id);
        return updated || existingVideo;
      });
      return { ...prev, results: updatedResults };
    });
  }, []);

  // Determine if polling should be active
  const shouldPoll = state.results.some(result => isProgressingStatus(result.status));

  // Use polling hook
  useVideoPolling(state.results, handleVideoUpdate, shouldPoll);

  const loadVideos = useCallback(async (currentPage: number) => {
    try {
      if (currentPage === 0) {
        setIsInitialLoading(true);
      } else {
        setIsAppending(true);
      }
      Logger.info('Client - Loading videos from database', { page: currentPage });
      
      const { videos, hasMore: newHasMore } = await fetchVideos(currentPage);
      
      setState(prev => ({
        ...prev,
        results: currentPage === 0 ? videos : [...prev.results, ...videos]
      }));
      setHasMore(newHasMore);
      
      Logger.info('Client - Videos loaded', { count: videos.length, page: currentPage, hasMore: newHasMore });
    } catch (error) {
      Logger.error('Client - Failed to load videos from database', {
        error: error instanceof Error ? error.message : error
      });
      setState(prev => ({ ...prev, error: '비디오 로딩에 실패했습니다.' }));
    } finally {
      if (currentPage === 0) {
        setIsInitialLoading(false);
      } else {
        setIsAppending(false);
      }
    }
  }, [fetchVideos]);

  // Load initial videos on mount
  useEffect(() => {
    loadVideos(0);
  }, [loadVideos]);

  const loadMoreVideos = useCallback(() => {
    if (!hasMore || state.isLoading || isAppending) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadVideos(nextPage);
  }, [page, hasMore, state.isLoading, isAppending, loadVideos]);

  const generateVideo = useCallback(async (koreanPrompt: string, config: AIModelConfig, userEmail: string) => {
    const startTime = Date.now();
    const id = uuidv4();
    
    Logger.info('Client - Starting video generation workflow', {
      requestId: id,
      koreanPrompt: koreanPrompt.substring(0, 100) + '...',
      userEmail,
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
      // Create initial DB record
      await createVideo({
        id: newResult.id,
        korean_prompt: newResult.koreanPrompt,
        english_prompt: '',
        user_email: userEmail,
        status: 'pending'
      });
      Logger.step('Client - Initial video record saved', { id });

      // Start the entire generation workflow on the server
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: id,
          koreanPrompt,
          config,
          userEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start video generation workflow');
      }

      const resultData = await response.json();
      
      // Update local state to 'generating'
      setState(prev => ({
        ...prev,
        isLoading: false,
        results: prev.results.map(r => 
          r.id === id ? { ...r, status: 'generating' } : r
        )
      }));

      const duration = Date.now() - startTime;
      Logger.info('Client - Video generation workflow started successfully', { 
        id,
        duration: `${duration}ms`,
        ...resultData
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      Logger.error('Client - Video generation workflow failed', { id, error: errorMessage });
      
      // Update UI with error state
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        results: prev.results.map(r =>
          r.id === id ? { ...r, status: 'error', errorMessage } : r
        )
      }));
      toast.error('프롬프트를 제출하지 못했습니다.', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [createVideo]);

  const deleteSelectedVideos = useCallback(async (deleteKey: string) => {
    const videoIdsToDelete = state.selectedIds;
    if (videoIdsToDelete.length === 0) {
      toast.info('삭제할 비디오를 선택해주세요.');
      return;
    }

    const toastId = toast.loading(`${videoIdsToDelete.length}개의 비디오를 삭제 중입니다...`);
    
    try {
      await deleteVideos(videoIdsToDelete, deleteKey);
      
      setState(prev => ({
        ...prev,
        results: prev.results.filter(r => !videoIdsToDelete.includes(r.id)),
        selectedIds: [],
      }));
      
      toast.success('선택한 비디오를 성공적으로 삭제했습니다.', { id: toastId });
    } catch (error) {
      Logger.error('Client - Failed to delete selected videos', { 
        error: error instanceof Error ? error.message : error 
      });
      toast.error('비디오 삭제에 실패했습니다.', {
        id: toastId,
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.selectedIds, deleteVideos]);

  const clearResults = useCallback(async (deleteKey: string) => {
    const toastId = toast.loading('모든 비디오를 삭제 중입니다...');
    try {
      await clearAllVideos(deleteKey);
      setState(prev => ({
        ...prev,
        results: [],
        selectedIds: [],
      }));
      toast.success('모든 비디오를 성공적으로 삭제했습니다.', { id: toastId });
    } catch (error) {
      Logger.error('Client - Failed to clear results', { 
        error: error instanceof Error ? error.message : error 
      });
      toast.error('모든 비디오 삭제에 실패했습니다.', {
        id: toastId,
        description: error instanceof Error ? error.message : String(error),
      });
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

  return {
    results: state.results,
    isLoading: state.isLoading,
    isAppending,
    error: state.error,
    selectedIds: state.selectedIds,
    isInitialLoading,
    hasMore,
    loadMoreVideos,
    generateVideo,
    clearResults,
    deleteSelectedVideos,
    toggleVideoSelection,
    selectAllVideos,
    deselectAllVideos
  };
}