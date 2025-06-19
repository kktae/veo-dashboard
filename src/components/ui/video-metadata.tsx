import { VideoGenerationResult } from '@/types';
import { Clock, Monitor } from 'lucide-react';

interface VideoMetadataProps {
  result: VideoGenerationResult;
  className?: string;
}

export function VideoMetadata({ result, className = '' }: VideoMetadataProps) {
  if (!result.duration && !result.resolution) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      {result.duration && (
        <span className="bg-black/80 text-white px-2 py-1 rounded flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {result.duration}초
        </span>
      )}
      {result.resolution && (
        <span className="bg-black/80 text-white px-2 py-1 rounded flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          {result.resolution}
        </span>
      )}
    </div>
  );
} 