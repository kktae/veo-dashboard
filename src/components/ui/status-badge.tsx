import { Badge } from './badge';
import { getStatusInfo } from '@/lib/constants';
import { VideoGenerationResult } from '@/types';
import { Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  status: VideoGenerationResult['status'];
  showLoader?: boolean;
  className?: string;
}

export function StatusBadge({ status, showLoader = false, className }: StatusBadgeProps) {
  const statusInfo = getStatusInfo(status);
  
  return (
    <Badge 
      variant={statusInfo.variant} 
      className={`flex items-center gap-1 ${className}`}
    >
      {showLoader && status !== 'completed' && status !== 'error' && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {statusInfo.text}
    </Badge>
  );
} 