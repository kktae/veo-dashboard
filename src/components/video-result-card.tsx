'use client';

import { useState } from 'react';
import { VideoGenerationResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Play, Clock, CheckCircle, XCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VideoPlayerModal } from './video-player-modal';

interface VideoResultCardProps {
  result: VideoGenerationResult;
  isSelected?: boolean;
  onToggleSelection?: (videoId: string) => void;
}

const statusConfig = {
  pending: { label: '대기중', icon: Clock, color: 'bg-gray-500' },
  translating: { label: '번역중', icon: Loader2, color: 'bg-blue-500' },
  generating: { label: '생성중', icon: Loader2, color: 'bg-yellow-500' },
  processing: { label: '처리중', icon: Loader2, color: 'bg-purple-500' },
  completed: { label: '완료', icon: CheckCircle, color: 'bg-green-500' },
  error: { label: '오류', icon: XCircle, color: 'bg-red-500' },
};

export function VideoResultCard({ result, isSelected = false, onToggleSelection }: VideoResultCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const config = statusConfig[result.status];
  const StatusIcon = config.icon;

  const handleDownload = () => {
    if (result.videoUrl) {
      const link = document.createElement('a');
      link.href = result.videoUrl;
      link.download = `video-${result.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSelectionChange = (checked: boolean) => {
    if (onToggleSelection) {
      onToggleSelection(result.id);
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <TooltipProvider>
      <Card className={`w-full h-[500px] flex flex-col transition-all duration-200 hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}>
        {/* Header - Fixed height */}
        <CardHeader className="pb-3 flex-shrink-0 h-[120px]">
          <div className="flex items-start justify-between h-full">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {onToggleSelection && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={handleSelectionChange}
                  className="mt-1 flex-shrink-0"
                  aria-label={`${result.koreanPrompt} 선택`}
                />
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-lg leading-tight cursor-pointer line-clamp-2 h-[3.5rem] overflow-hidden">
                      {result.koreanPrompt}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <p>{result.koreanPrompt}</p>
                  </TooltipContent>
                </Tooltip>
                {result.englishPrompt && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardDescription className="text-sm cursor-pointer line-clamp-1 h-[1.5rem] overflow-hidden">
                        번역: {result.englishPrompt}
                      </CardDescription>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p>번역: {result.englishPrompt}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <Badge variant="secondary" className={`${config.color} text-white flex-shrink-0`}>
              <StatusIcon 
                className={`mr-1 h-3 w-3 ${
                  result.status === 'translating' || result.status === 'generating' || result.status === 'processing'
                    ? 'animate-spin' 
                    : ''
                }`} 
              />
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        
        {/* Content - Flexible height */}
        <CardContent className="pt-0 flex-1 flex flex-col min-h-0 pb-4">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Timestamp - Fixed height */}
            <div className="text-xs text-muted-foreground flex-shrink-0 h-[20px]">
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
              <div className="flex-1 flex flex-col min-h-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 cursor-pointer flex-1 overflow-hidden">
                      <div className="line-clamp-3">
                        오류: {result.error}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <p>오류: {result.error}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Video display */}
            {result.status === 'completed' && result.videoUrl && (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                {/* Thumbnail with play button overlay - Flexible height */}
                <div className="relative group cursor-pointer rounded-md overflow-hidden bg-black flex-1 min-h-[180px]">
                  {result.thumbnailUrl ? (
                    <img
                      src={result.thumbnailUrl}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onClick={() => setIsModalOpen(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-500" />
                    </div>
                  )}
                  
                  {/* Play button overlay */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <div className="bg-white/90 rounded-full p-3 shadow-lg">
                      <Play className="h-8 w-8 text-black ml-1" />
                    </div>
                  </div>
                </div>
                
                {/* Video metadata - Fixed height */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0 h-[24px]">
                  {result.duration && (
                    <span className="bg-black/80 text-white px-2 py-1 rounded">
                      {result.duration}초
                    </span>
                  )}
                  {result.resolution && (
                    <span className="bg-black/80 text-white px-2 py-1 rounded">
                      {result.resolution}
                    </span>
                  )}
                </div>
                
                {/* Action buttons - Fixed height */}
                <div className="flex gap-2 flex-shrink-0 h-[32px]">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 h-8"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    재생
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 h-8"
                    onClick={handleDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    다운로드
                  </Button>
                </div>
              </div>
            )}

            {/* Loading state for generating */}
            {(result.status === 'translating' || result.status === 'generating' || result.status === 'processing') && (
              <div className="rounded-md bg-blue-50 p-4 text-center border border-blue-200 flex-1 flex items-center justify-center min-h-[200px]">
                <div className="space-y-2">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-sm text-blue-800">
                    {result.status === 'translating' 
                      ? '한국어를 영어로 번역하고 있습니다...' 
                      : result.status === 'generating'
                      ? '비디오를 생성하고 있습니다...'
                      : '비디오를 다운로드하고 썸네일을 생성하고 있습니다...'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        {/* Video Player Modal */}
        {result.status === 'completed' && result.videoUrl && (
          <VideoPlayerModal
            video={result}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </Card>
    </TooltipProvider>
  );
} 