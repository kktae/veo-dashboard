import { useState, useEffect, useCallback } from 'react';

export interface VideoSyncStatus {
  videoId: string;
  status: 'synced' | 'downloading' | 'error' | 'missing_gcs';
  localVideoPath?: string;
  localThumbnailPath?: string;
  error?: string;
}

interface VideoSyncState {
  syncStatuses: VideoSyncStatus[];
  isInitializing: boolean;
  lastInitialized: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useVideoSync() {
  const [state, setState] = useState<VideoSyncState>({
    syncStatuses: [],
    isInitializing: false,
    lastInitialized: null,
    isLoading: false,
    error: null
  });

  // 동기화 상태 조회
  const fetchSyncStatus = useCallback(async (videoId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const params = videoId ? `?videoId=${encodeURIComponent(videoId)}` : '';
      const response = await fetch(`/api/videos/sync${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch sync status');
      }
      
      setState(prev => ({
        ...prev,
        syncStatuses: Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []),
        isLoading: false
      }));
      
      return data.data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
      throw error;
    }
  }, []);

  // 동기화 서비스 초기화
  const initializeSync = useCallback(async () => {
    setState(prev => ({ ...prev, isInitializing: true, error: null }));
    
    try {
      const response = await fetch('/api/videos/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initialize' })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize sync service');
      }
      
      setState(prev => ({
        ...prev,
        isInitializing: false,
        lastInitialized: new Date()
      }));
      
      // 초기화 후 상태 새로고침
      await fetchSyncStatus();
      
      return data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitializing: false
      }));
      throw error;
    }
  }, [fetchSyncStatus]);

  // 특정 비디오 동기화
  const syncVideo = useCallback(async (videoId: string, gcsUri: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch('/api/videos/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'sync',
          videoId,
          gcsUri
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync video');
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      
      // 동기화 후 상태 새로고침
      await fetchSyncStatus();
      
      return data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
      throw error;
    }
  }, [fetchSyncStatus]);

  // 특정 비디오의 동기화 상태 반환
  const getVideoSyncStatus = useCallback((videoId: string): VideoSyncStatus | undefined => {
    return state.syncStatuses.find(status => status.videoId === videoId);
  }, [state.syncStatuses]);

  // 컴포넌트 마운트 시 동기화 상태 조회
  useEffect(() => {
    fetchSyncStatus().catch(error => {
      console.warn('Failed to fetch initial sync status:', error);
    });
  }, [fetchSyncStatus]);

  // 주기적으로 동기화 상태 업데이트 (다운로드 중인 비디오가 있을 때)
  useEffect(() => {
    const downloadingVideos = state.syncStatuses.filter(status => status.status === 'downloading');
    
    if (downloadingVideos.length > 0) {
      const interval = setInterval(() => {
        fetchSyncStatus().catch(error => {
          console.warn('Failed to refresh sync status:', error);
        });
      }, 5000); // 5초마다 업데이트
      
      return () => clearInterval(interval);
    }
  }, [state.syncStatuses, fetchSyncStatus]);

  return {
    syncStatuses: state.syncStatuses,
    isInitializing: state.isInitializing,
    lastInitialized: state.lastInitialized,
    isLoading: state.isLoading,
    error: state.error,
    fetchSyncStatus,
    initializeSync,
    syncVideo,
    getVideoSyncStatus
  };
} 