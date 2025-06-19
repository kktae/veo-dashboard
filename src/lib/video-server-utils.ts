import { Storage } from '@google-cloud/storage';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { Logger } from './logger';

// FFmpeg 동시 실행 제한을 위한 큐 시스템
class VideoProcessingQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private readonly maxConcurrent = parseInt(process.env.MAX_CONCURRENT_FFMPEG_PROCESSES || '3');

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();
    
    if (task) {
      try {
        await task();
      } finally {
        this.running--;
        this.process(); // 다음 작업 처리
      }
    }
  }
}

const videoProcessingQueue = new VideoProcessingQueue();

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
    // Parse GCS URI
    const match = gcsUri.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (!match) {
      throw new Error('Invalid GCS URI format');
    }
    
    const bucketName = match[1];
    const fileName = match[2];

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found in GCS: ${gcsUri}`);
    }

    // Create temporary directories
    const tempDir = path.join(process.cwd(), 'temp');
    const videoDir = path.join(tempDir, 'videos');
    const thumbnailDir = path.join(tempDir, 'thumbnails');
    
    await fs.mkdir(videoDir, { recursive: true });
    await fs.mkdir(thumbnailDir, { recursive: true });

    // Download video file
    const videoPath = path.join(videoDir, `${videoId}.mp4`);
    const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

    Logger.step('Video Utils - Downloading video from GCS', { videoId, bucketName, fileName });

    await file.download({ destination: videoPath });

    Logger.step('Video Utils - Video downloaded, generating thumbnail', { videoId, videoPath });

    // Generate thumbnail and extract metadata using FFmpeg
    const metadata = await videoProcessingQueue.add(() => 
      generateThumbnailAndMetadata(videoPath, thumbnailPath, videoId)
    );

    Logger.step('Video Utils - Thumbnail generated, uploading to public directory', { videoId });

    // Move files to public directory
    const publicVideoDir = path.join(process.cwd(), 'public', 'videos');
    const publicThumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
    
    await fs.mkdir(publicVideoDir, { recursive: true });
    await fs.mkdir(publicThumbnailDir, { recursive: true });

    const finalVideoPath = path.join(publicVideoDir, `${videoId}.mp4`);
    const finalThumbnailPath = path.join(publicThumbnailDir, `${videoId}.jpg`);

    await fs.rename(videoPath, finalVideoPath);
    await fs.rename(thumbnailPath, finalThumbnailPath);

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      Logger.warn('Video Utils - Failed to clean up temp directory', { error });
    }

    const result = {
      videoUrl: `/videos/${videoId}.mp4`,
      thumbnailUrl: `/thumbnails/${videoId}.jpg`,
      duration: metadata.duration,
      resolution: metadata.resolution
    };

    Logger.step('Video Utils - Video processing completed', { 
      videoId, 
      duration: metadata.duration,
      resolution: metadata.resolution
    });

    return result;

  } catch (error) {
    Logger.error('Video Utils - Failed to download and process video', {
      error: error instanceof Error ? error.message : error,
      gcsUri,
      videoId
    });
    throw error;
  }
}

/**
 * Generate thumbnail and extract metadata using FFmpeg
 */
async function generateThumbnailAndMetadata(
  videoPath: string, 
  thumbnailPath: string, 
  videoId: string
): Promise<{ duration?: number; resolution?: string }> {
  return new Promise((resolve, reject) => {
    let duration: number | undefined;
    let resolution: string | undefined;

    ffmpeg(videoPath)
      .on('start', (commandLine) => {
        Logger.step('Video Utils - FFmpeg started', { videoId, command: commandLine });
      })
      .on('codecData', (data) => {
        Logger.step('Video Utils - FFmpeg codec data', { 
          videoId, 
          duration: data.duration,
          format: data.format,
          video: data.video,
          audio: data.audio
        });
        
        // Parse duration
        if (data.duration) {
          const parts = data.duration.split(':');
          if (parts.length === 3) {
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseFloat(parts[2]);
            duration = hours * 3600 + minutes * 60 + seconds;
          }
        }

        // Parse resolution
        if (data.video) {
          const videoInfo = data.video.split(',')[0];
          const resolutionMatch = videoInfo.match(/(\d+)x(\d+)/);
          if (resolutionMatch) {
            resolution = `${resolutionMatch[1]}x${resolutionMatch[2]}`;
          }
        }
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          Logger.step('Video Utils - FFmpeg progress', { 
            videoId, 
            percent: Math.round(progress.percent),
            timemark: progress.timemark
          });
        }
      })
      .on('end', () => {
        Logger.step('Video Utils - FFmpeg processing finished', { 
          videoId,
          duration,
          resolution
        });
        resolve({ duration, resolution });
      })
      .on('error', (err) => {
        Logger.error('Video Utils - FFmpeg error', { 
          videoId,
          error: err.message
        });
        reject(err);
      })
      .screenshots({
        timestamps: ['50%'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '1280x720'
      });
  });
} 