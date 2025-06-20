'use client';

import { useState } from 'react';
import { VideoGenerationResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { VideoMetadata } from '@/components/ui/video-metadata';
import { TruncatedText } from '@/components/ui/truncated-text';
import { Download, Play, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VideoPlayerModal } from './video-player-modal';
import { Progress } from "@/components/ui/progress";
import { downloadVideo, generateVideoFilename } from '@/lib/video-utils';
import { getStatusInfo, isCompletedStatus, isErrorStatus } from '@/lib/constants';
import { UI_CONFIG } from '@/lib/constants';

interface VideoResultCardProps {
  result: VideoGenerationResult;
  isSelected?: boolean;
  onToggleSelection?: (videoId: string) => void;
}

export function VideoResultCard({ result, isSelected = false, onToggleSelection }: VideoResultCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const statusInfo = getStatusInfo(result.status);

  const handleDownload = () => {
    if (result.videoUrl) {
      const filename = generateVideoFilename(result);
      downloadVideo(result.videoUrl, filename);
    }
  };

  const handleSelectionChange = () => {
    if (onToggleSelection) {
      onToggleSelection(result.id);
    }
  };

  const formatTimestamp = (date: Date, label?: string) => {
    const formatted = formatDistanceToNow(date, { 
      addSuffix: true, 
      locale: ko 
    });
    return label ? `${label}: ${formatted}` : formatted;
  };

  return (
    <Card className={`w-full h-[${UI_CONFIG.CARD_HEIGHT}px] flex flex-col transition-all duration-200 hover:shadow-md ${
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
              <TruncatedText
                text={result.koreanPrompt}
                maxLength={UI_CONFIG.TRUNCATE_LENGTH.TITLE}
                className="text-lg leading-tight line-clamp-2 h-[3.5rem] overflow-hidden"
              >
                {(truncated) => <CardTitle className="text-lg leading-tight cursor-pointer line-clamp-2 h-[3.5rem] overflow-hidden">{truncated}</CardTitle>}
              </TruncatedText>
              
              {result.englishPrompt && (
                <TruncatedText
                  text={`번역: ${result.englishPrompt}`}
                  maxLength={UI_CONFIG.TRUNCATE_LENGTH.TITLE}
                  className="text-sm line-clamp-1 h-[1.5rem] overflow-hidden"
                >
                  {(truncated) => <CardDescription className="text-sm cursor-pointer line-clamp-1 h-[1.5rem] overflow-hidden">{truncated}</CardDescription>}
                </TruncatedText>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <StatusBadge status={result.status} showLoader />
            {!isCompletedStatus(result.status) && !isErrorStatus(result.status) && (
              <span className="text-sm text-gray-500">
                새로고침해도 진행상태가 유지됩니다
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      {/* Content - Flexible height */}
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 pb-4">
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* User and Timestamp - Fixed height */}
          <div className="text-xs text-muted-foreground flex-shrink-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-blue-600">{result.userEmail}</span>
              <span>•</span>
              <span>{formatTimestamp(result.createdAt)}</span>
              {result.completedAt && (
                <span>
                  • {formatTimestamp(result.completedAt, '완료')}
                </span>
              )}
            </div>
          </div>

          {/* Error display */}
          {isErrorStatus(result.status) && result.error && (
            <div className="flex-1 flex flex-col min-h-0">
              <TruncatedText
                text={`오류: ${result.error}`}
                maxLength={UI_CONFIG.TRUNCATE_LENGTH.TOOLTIP}
                className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 cursor-pointer flex-1 overflow-hidden"
              >
                {(truncated) => (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 cursor-pointer flex-1 overflow-hidden">
                    <div className="line-clamp-3">{truncated}</div>
                  </div>
                )}
              </TruncatedText>
            </div>
          )}

          {/* Video display */}
          {isCompletedStatus(result.status) && result.videoUrl && (
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              {/* Thumbnail with play button overlay - Flexible height */}
              <div className={`relative group cursor-pointer rounded-md overflow-hidden bg-black flex-1 min-h-[${UI_CONFIG.THUMBNAIL_MIN_HEIGHT}px]`}>
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
              <VideoMetadata result={result} className="flex-shrink-0 h-[24px]" />
            </div>
          )}

          {/* Progress display for non-completed videos */}
          {!isCompletedStatus(result.status) && !isErrorStatus(result.status) && (
            <div className="space-y-2">
              <Progress value={statusInfo.progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {statusInfo.progress}% 완료
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isCompletedStatus(result.status) && result.videoUrl && (
          <div className="flex gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex-1"
            >
              <Play className="mr-2 h-4 w-4" />
              재생
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              다운로드
            </Button>
          </div>
        )}
      </CardContent>

      {/* Video Player Modal */}
      {isModalOpen && result.videoUrl && (
        <VideoPlayerModal 
          video={result}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </Card>
  );
} 