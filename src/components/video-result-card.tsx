'use client';

import { useState } from 'react';
import { VideoGenerationResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { VideoMetadata } from '@/components/ui/video-metadata';
import { TruncatedText } from '@/components/ui/truncated-text';
import { Download, Play, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VideoPlayerModal } from './video-player-modal';
import { Progress } from "@/components/ui/progress";
import { downloadVideo, generateVideoFilename } from '@/lib/video-utils';
import { getStatusInfo, isCompletedStatus, isErrorStatus, isProgressingStatus } from '@/lib/constants';
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
    <Card className={`w-full flex flex-col transition-all duration-200 hover:shadow-lg hover:border-blue-500 hover:-translate-y-1 ${
      isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
    }`}>
      <CardHeader className="p-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {onToggleSelection && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleSelectionChange}
                className="mt-0.5 flex-shrink-0"
                aria-label={`${result.koreanPrompt} 선택`}
              />
            )}
            <div className="space-y-0.5 flex-1 min-w-0">
              <TruncatedText
                text={result.koreanPrompt}
                maxLength={UI_CONFIG.TRUNCATE_LENGTH.TITLE}
                className="text-base font-semibold leading-snug line-clamp-2"
              >
                {(truncated) => <CardTitle className="text-base font-semibold leading-snug cursor-pointer">{truncated}</CardTitle>}
              </TruncatedText>
              
              {result.englishPrompt && (
                <TruncatedText
                  text={`번역: ${result.englishPrompt}`}
                  maxLength={UI_CONFIG.TRUNCATE_LENGTH.TITLE}
                  className="text-xs text-gray-500 line-clamp-1"
                >
                  {(truncated) => <CardDescription className="text-xs text-gray-500 cursor-pointer">{truncated}</CardDescription>}
                </TruncatedText>
              )}
            </div>
          </div>
          <div className="space-y-1 text-right flex-shrink-0 ml-4">
            <StatusBadge status={result.status} />
            {isProgressingStatus(result.status) && (
              <span className="text-xs text-gray-400 block w-[110px]">
                새로고침해도 유지됩니다
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 pb-3 px-4">
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="text-xs text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-blue-600">{result.userEmail}</span>
              <span>•</span>
              <span>{formatTimestamp(result.createdAt)}</span>
              {result.completedAt && (
                <span className="truncate">
                  • 완료: {formatDistanceToNow(result.completedAt, { locale: ko })}
                </span>
              )}
            </div>
          </div>

          {isErrorStatus(result.status) && result.error && (
            <div className="flex-1 flex flex-col min-h-0">
              <TruncatedText
                text={`오류: ${result.error}`}
                maxLength={UI_CONFIG.TRUNCATE_LENGTH.TOOLTIP}
                className="rounded-md bg-red-50 p-2 text-xs text-red-800 border border-red-200 cursor-pointer flex-1 overflow-hidden"
              >
                {(truncated) => (
                  <div className="rounded-md bg-red-50 p-2 text-xs text-red-800 border border-red-200 cursor-pointer flex-1 overflow-hidden">
                    <div className="line-clamp-3">{truncated}</div>
                  </div>
                )}
              </TruncatedText>
            </div>
          )}

          {isCompletedStatus(result.status) && result.videoUrl && (
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
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
                    <ImageIcon className="h-10 w-10 text-gray-500" />
                  </div>
                )}
                
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsModalOpen(true)}
                >
                  <div className="bg-white/90 rounded-full p-2.5 shadow-lg">
                    <Play className="h-6 w-6 text-black ml-0.5" />
                  </div>
                </div>
              </div>
              
              <VideoMetadata result={result} className="flex-shrink-0 h-[20px] text-xs" />
            </div>
          )}

          {isProgressingStatus(result.status) && (
            <div className="flex flex-col items-center justify-center space-y-2 text-center h-full py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-medium">{statusInfo.text}...</p>
              </div>
              <Progress value={statusInfo.progress} className="w-3/4" />
            </div>
          )}
        </div>

        {isCompletedStatus(result.status) && result.videoUrl && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 py-1 h-auto"
            >
              <Play className="mr-1.5 h-4 w-4" />
              재생
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex-1 py-1 h-auto"
            >
              <Download className="mr-1.5 h-4 w-4" />
              다운로드
            </Button>
          </div>
        )}
      </CardContent>

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