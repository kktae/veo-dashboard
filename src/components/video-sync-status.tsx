'use client';

import { useVideoSync } from '@/hooks/use-video-sync';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export function VideoSyncStatus() {
  const { 
    syncStatuses, 
    isInitializing, 
    lastInitialized, 
    isLoading, 
    error,
    initializeSync,
    fetchSyncStatus
  } = useVideoSync();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleInitialize = async () => {
    try {
      await initializeSync();
    } catch (error) {
      console.error('Failed to initialize sync:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSyncStatus();
    } catch (error) {
      console.error('Failed to refresh sync status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'missing_gcs':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">동기화됨</Badge>;
      case 'downloading':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">다운로드 중</Badge>;
      case 'error':
        return <Badge variant="destructive">오류</Badge>;
      case 'missing_gcs':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">GCS 없음</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  const syncedCount = syncStatuses.filter(s => s.status === 'synced').length;
  const downloadingCount = syncStatuses.filter(s => s.status === 'downloading').length;
  const errorCount = syncStatuses.filter(s => s.status === 'error').length;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              비디오 동기화 상태
            </CardTitle>
            <CardDescription>
              GCS에서 로컬로 비디오 파일 동기화 상태를 확인하고 관리합니다.
              {lastInitialized && (
                <span className="block mt-1 text-xs">
                  마지막 초기화: {lastInitialized.toLocaleString()}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button
              onClick={handleInitialize}
              disabled={isInitializing}
              size="sm"
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  초기화 중...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  동기화 초기화
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 요약 통계 */}
        {syncStatuses.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{syncStatuses.length}</div>
              <div className="text-sm text-gray-600">총 비디오</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{syncedCount}</div>
              <div className="text-sm text-gray-600">동기화됨</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{downloadingCount}</div>
              <div className="text-sm text-gray-600">다운로드 중</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-gray-600">오류</div>
            </div>
          </div>
        )}

        {/* 비디오별 상태 목록 */}
        {syncStatuses.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {syncStatuses.map((status) => (
              <div
                key={status.videoId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      비디오 ID: {status.videoId}
                    </div>
                    {status.error && (
                      <div className="text-xs text-red-600 truncate">
                        {status.error}
                      </div>
                    )}
                    {status.localVideoPath && (
                      <div className="text-xs text-gray-500 truncate">
                        {status.localVideoPath}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(status.status)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Download className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>동기화할 비디오가 없습니다.</p>
            <p className="text-sm mt-1">
              비디오가 생성되면 자동으로 동기화됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 