'use client';

import { VideoGenerationResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Eye, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface VideoResultCardProps {
  result: VideoGenerationResult;
}

const statusConfig = {
  pending: { label: '대기중', icon: Clock, color: 'bg-gray-500' },
  translating: { label: '번역중', icon: Loader2, color: 'bg-blue-500' },
  generating: { label: '생성중', icon: Loader2, color: 'bg-yellow-500' },
  completed: { label: '완료', icon: CheckCircle, color: 'bg-green-500' },
  error: { label: '오류', icon: XCircle, color: 'bg-red-500' },
};

export function VideoResultCard({ result }: VideoResultCardProps) {
  const config = statusConfig[result.status];
  const StatusIcon = config.icon;

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg leading-tight">
              {result.koreanPrompt}
            </CardTitle>
            {result.englishPrompt && (
              <CardDescription className="text-sm">
                번역: {result.englishPrompt}
              </CardDescription>
            )}
          </div>
          <Badge variant="secondary" className={`${config.color} text-white`}>
            <StatusIcon 
              className={`mr-1 h-3 w-3 ${
                result.status === 'translating' || result.status === 'generating' 
                  ? 'animate-spin' 
                  : ''
              }`} 
            />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Timestamp */}
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(result.createdAt, { 
              addSuffix: true, 
              locale: ko 
            })}
            {result.completedAt && (
              <span className="ml-2">
                • 완료: {formatDistanceToNow(result.completedAt, { 
                  addSuffix: true, 
                  locale: ko 
                })}
              </span>
            )}
          </div>

          {/* Error display */}
          {result.status === 'error' && result.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              오류: {result.error}
            </div>
          )}

          {/* Video display */}
          {result.status === 'completed' && result.videoUrl && (
            <div className="space-y-2">
              <video
                controls
                className="w-full rounded-md bg-black"
                poster="/placeholder-video.jpg"
              >
                <source src={result.videoUrl} type="video/mp4" />
                브라우저에서 비디오를 지원하지 않습니다.
              </video>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  전체화면
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  다운로드
                </Button>
              </div>
            </div>
          )}

          {/* Loading state for generating */}
          {(result.status === 'translating' || result.status === 'generating') && (
            <div className="rounded-md bg-blue-50 p-4 text-center border border-blue-200">
              <div className="space-y-2">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                <p className="text-sm text-blue-800">
                  {result.status === 'translating' 
                    ? '한국어를 영어로 번역하고 있습니다...' 
                    : '비디오를 생성하고 있습니다...'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 