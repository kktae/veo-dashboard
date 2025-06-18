import { VideoGenerationResult } from '@/types';
import { VideoRecord } from './database';
import { Storage } from '@google-cloud/storage';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { Logger } from './logger';

/**
 * Convert database VideoRecord to VideoGenerationResult
 */
export function recordToResult(record: VideoRecord): VideoGenerationResult {
  return {
    id: record.id,
    koreanPrompt: record.korean_prompt,
    englishPrompt: record.english_prompt,
    status: record.status,
    videoUrl: record.video_url || undefined,
    thumbnailUrl: record.thumbnail_url || undefined,
    duration: record.duration || undefined,
    resolution: record.resolution || undefined,
    error: record.error_message || undefined,
    createdAt: new Date(record.created_at),
    completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
  };
}

/**
 * Convert VideoGenerationResult to database VideoRecord format
 */
export function resultToRecord(result: VideoGenerationResult): Omit<VideoRecord, 'created_at' | 'completed_at'> & {
  created_at?: string;
  completed_at?: string;
} {
  return {
    id: result.id,
    korean_prompt: result.koreanPrompt,
    english_prompt: result.englishPrompt,
    status: result.status,
    video_url: result.videoUrl || undefined,
    thumbnail_url: result.thumbnailUrl || undefined,
    duration: result.duration || undefined,
    resolution: result.resolution || undefined,
    error_message: result.error || undefined,
    created_at: result.createdAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
  };
}

/**
 * Convert array of VideoRecords to VideoGenerationResults
 */
export function recordsToResults(records: VideoRecord[]): VideoGenerationResult[] {
  return records.map(recordToResult);
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

// Initialize Google Cloud Storage client
const storage = new Storage();

/**
 * Download video from GCS and generate thumbnail
 */
export async function downloadAndProcessVideo(gcsUri: string, videoId: string): Promise<{
  videoUrl: string;
  thumbnailUrl: string;
  duration?: number;
  resolution?: string;
}> {
  Logger.step('Video Utils - Starting video download and processing', {
    gcsUri: gcsUri.substring(0, 50) + '...',
    videoId
  });

  try {
    // Parse GCS URI: gs://bucket-name/path/file.mp4
    const uriMatch = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!uriMatch) {
      throw new Error(`Invalid GCS URI format: ${gcsUri}`);
    }

    const [, bucketName, filePath] = uriMatch;
    
    // Ensure directories exist
    const videosDir = path.join(process.cwd(), 'public', 'videos');
    const thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    
    await fs.mkdir(videosDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Set up local file paths
    const localVideoPath = path.join(videosDir, `${videoId}.mp4`);
    const localThumbnailPath = path.join(thumbnailsDir, `${videoId}.jpg`);

    Logger.step('Video Utils - Downloading video from GCS', {
      bucketName,
      filePath,
      localVideoPath
    });

    // Download video from GCS
    await storage.bucket(bucketName).file(filePath).download({
      destination: localVideoPath
    });

    Logger.step('Video Utils - Video download completed, generating thumbnail', {
      videoId,
      videoSize: (await fs.stat(localVideoPath)).size
    });

    // Generate thumbnail and get video metadata
    const metadata = await generateThumbnailAndMetadata(localVideoPath, localThumbnailPath, videoId);

    const result = {
      videoUrl: `/videos/${videoId}.mp4`,
      thumbnailUrl: `/thumbnails/${videoId}.jpg`,
      duration: metadata.duration,
      resolution: metadata.resolution
    };

    Logger.step('Video Utils - Video processing completed successfully', {
      videoId,
      ...result
    });

    return result;
  } catch (error) {
    Logger.error('Video Utils - Video processing failed', {
      videoId,
      gcsUri: gcsUri.substring(0, 50) + '...',
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Generate thumbnail and extract video metadata using FFmpeg
 */
async function generateThumbnailAndMetadata(
  videoPath: string, 
  thumbnailPath: string, 
  videoId: string
): Promise<{ duration?: number; resolution?: string }> {
  return new Promise((resolve, reject) => {
    Logger.step('Video Utils - Starting FFmpeg processing', {
      videoId,
      videoPath: path.basename(videoPath),
      thumbnailPath: path.basename(thumbnailPath)
    });

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['50%'], // Take screenshot at 50% of video duration
        filename: `${videoId}.jpg`,
        folder: path.dirname(thumbnailPath),
        size: '1920x1080'
      })
      .on('end', () => {
        Logger.step('Video Utils - Thumbnail generation completed', {
          videoId,
          thumbnailPath: path.basename(thumbnailPath)
        });

        // Get video metadata
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            Logger.warn('Video Utils - Failed to extract metadata, using defaults', {
              videoId,
              error: err.message
            });
            resolve({ duration: 8, resolution: '1920x1080' });
            return;
          }

          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const duration = metadata.format.duration ? Math.round(metadata.format.duration) : 8;
          const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : '1920x1080';

          Logger.step('Video Utils - Metadata extraction completed', {
            videoId,
            duration,
            resolution,
            originalDuration: metadata.format.duration
          });

          resolve({ duration, resolution });
        });
      })
      .on('error', (err) => {
        Logger.error('Video Utils - Thumbnail generation failed', {
          videoId,
          error: err.message
        });
        reject(err);
      });
  });
} 