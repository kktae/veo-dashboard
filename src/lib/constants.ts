import { VideoGenerationResult } from '@/types';

// Status related constants
export const VIDEO_STATUS = {
  PENDING: 'pending',
  TRANSLATING: 'translating', 
  GENERATING: 'generating',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

export const STATUS_INFO = {
  [VIDEO_STATUS.PENDING]: { 
    text: '대기 중', 
    progress: 10, 
    color: 'bg-gray-500',
    variant: 'secondary' as const
  },
  [VIDEO_STATUS.TRANSLATING]: { 
    text: '번역 중', 
    progress: 25, 
    color: 'bg-blue-500',
    variant: 'secondary' as const
  },
  [VIDEO_STATUS.GENERATING]: { 
    text: '영상 생성 중', 
    progress: 50, 
    color: 'bg-yellow-500',
    variant: 'secondary' as const
  },
  [VIDEO_STATUS.PROCESSING]: { 
    text: '후처리 중', 
    progress: 75, 
    color: 'bg-orange-500',
    variant: 'secondary' as const
  },
  [VIDEO_STATUS.COMPLETED]: { 
    text: '완료', 
    progress: 100, 
    color: 'bg-green-500',
    variant: 'default' as const
  },
  [VIDEO_STATUS.ERROR]: { 
    text: '오류', 
    progress: 0, 
    color: 'bg-red-500',
    variant: 'secondary' as const
  }
} as const;

// API Configuration
export const API_CONFIG = {
  POLLING_INTERVAL: 3000,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 5000,
  REQUEST_TIMEOUT: 10000
} as const;

// UI Constants
export const UI_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  THUMBNAIL_MIN_HEIGHT: 180,
  TRUNCATE_LENGTH: {
    TITLE: 100,
    PREVIEW: 50,
    TOOLTIP: 400
  }
} as const;

// Helper functions
export const getStatusInfo = (status: VideoGenerationResult['status']) => {
  return STATUS_INFO[status] || STATUS_INFO[VIDEO_STATUS.ERROR];
};

export const isProgressingStatus = (status: VideoGenerationResult['status']) => {
  return [
    VIDEO_STATUS.PENDING,
    VIDEO_STATUS.TRANSLATING, 
    VIDEO_STATUS.GENERATING,
    VIDEO_STATUS.PROCESSING
  ].includes(status as any);
};

export const isCompletedStatus = (status: VideoGenerationResult['status']) => {
  return status === VIDEO_STATUS.COMPLETED;
};

export const isErrorStatus = (status: VideoGenerationResult['status']) => {
  return status === VIDEO_STATUS.ERROR;
}; 