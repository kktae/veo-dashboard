import { VideoGenerationResult } from '@/types';
import { VideoRecord } from './database';

export const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const downloadVideo = (videoUrl: string, filename?: string): void => {
  const link = document.createElement('a');
  link.href = videoUrl;
  link.download = filename || `video-${Date.now()}.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const convertDatabaseRecordToResult = (record: VideoRecord): VideoGenerationResult => {
  return {
    id: record.id,
    koreanPrompt: record.korean_prompt,
    englishPrompt: record.english_prompt,
    status: record.status,
    videoUrl: record.video_url || undefined,
    thumbnailUrl: record.thumbnail_url || undefined,
    gcsUri: record.gcs_uri || undefined,
    duration: record.duration || undefined,
    resolution: record.resolution || undefined,
    error: record.error_message || undefined,
    createdAt: new Date(record.created_at),
    completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
  };
};

export const convertResultToDatabaseRecord = (
  result: VideoGenerationResult
): Partial<VideoRecord> => {
  return {
    id: result.id,
    korean_prompt: result.koreanPrompt,
    english_prompt: result.englishPrompt,
    status: result.status,
    video_url: result.videoUrl,
    thumbnail_url: result.thumbnailUrl,
    gcs_uri: result.gcsUri,
    duration: result.duration,
    resolution: result.resolution,
    error_message: result.error,
    created_at: result.createdAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
  };
};

export const getVideoMetadata = (
  result: VideoGenerationResult
): { duration: string; resolution: string } => {
  return {
    duration: result.duration ? `${result.duration}초` : '알 수 없음',
    resolution: result.resolution || '알 수 없음'
  };
};

export const validateVideoUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.includes('.mp4') || url.includes('video') || url.includes('googleapis');
  } catch {
    return false;
  }
};

export const generateVideoFilename = (
  result: VideoGenerationResult,
  extension: string = 'mp4'
): string => {
  const sanitizedPrompt = result.koreanPrompt
    .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
    
  return `${sanitizedPrompt}_${result.id.substring(0, 8)}.${extension}`;
};

/**
 * Convert array of VideoRecords to VideoGenerationResults
 */
export function recordsToResults(records: VideoRecord[]): VideoGenerationResult[] {
  return records.map(convertDatabaseRecordToResult);
}

/**
 * Create partial update object for database from result changes
 */
export function createUpdateFromResult(
  changes: Partial<VideoGenerationResult>
): Partial<Omit<VideoRecord, 'id' | 'created_at'>> {
  const update: Partial<Omit<VideoRecord, 'id' | 'created_at'>> = {};

  if (changes.englishPrompt !== undefined) {
    update.english_prompt = changes.englishPrompt;
  }
  if (changes.status !== undefined) {
    update.status = changes.status;
  }
  if (changes.videoUrl !== undefined) {
    update.video_url = changes.videoUrl;
  }
  if (changes.thumbnailUrl !== undefined) {
    update.thumbnail_url = changes.thumbnailUrl;
  }
  if (changes.gcsUri !== undefined) {
    update.gcs_uri = changes.gcsUri;
  }
  if (changes.duration !== undefined) {
    update.duration = changes.duration;
  }
  if (changes.resolution !== undefined) {
    update.resolution = changes.resolution;
  }
  if (changes.error !== undefined) {
    update.error_message = changes.error;
  }
  if (changes.completedAt !== undefined) {
    update.completed_at = changes.completedAt.toISOString();
  }

  return update;
}

/**
 * 유효한 해상도 형식인지 검증 (예: "1920x1080")
 */
export function isValidResolution(resolution: string | undefined | null): boolean {
  if (!resolution) return false;
  const resolutionPattern = /^\d+x\d+$/;
  return resolutionPattern.test(resolution);
}

/**
 * 해상도 값을 검증하고 유효한 값만 반환
 */
export function validateResolution(resolution: string | undefined | null, videoId?: string): string | undefined {
  if (!resolution) return undefined;
  
  if (isValidResolution(resolution)) {
    return resolution;
  }
  
  // 로그 출력 (videoId가 있는 경우에만)
  if (videoId && console && console.warn) {
    console.warn(`Invalid resolution format detected for video ${videoId}: ${resolution}`);
  }
  
  return undefined;
}

 