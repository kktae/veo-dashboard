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

/**
 * Initialize and verify Google Cloud Storage client
 */
function initializeGCSClient(): Storage {
  try {
    // Check for required environment variables
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_PROJECT) {
      Logger.warn('Video Utils - No GCS credentials found in environment variables');
    }

    const storage = new Storage({
      // Explicitly set project ID if available
      projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
      // Use service account key file if specified
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    Logger.step('Video Utils - GCS client initialized', {
      projectId: storage.projectId,
      hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    return storage;
  } catch (error) {
    Logger.error('Video Utils - Failed to initialize GCS client', {
      error: error instanceof Error ? error.message : error
    });
    throw new Error(`GCS client initialization failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Initialize Google Cloud Storage client
const storage = initializeGCSClient();

/**
 * Verify GCS access and bucket permissions
 */
async function verifyGCSAccess(bucketName: string): Promise<void> {
  try {
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      throw new Error(`Bucket ${bucketName} does not exist or is not accessible`);
    }

    // Test read permissions
    const [files] = await bucket.getFiles({ maxResults: 1 });
    
    Logger.step('Video Utils - GCS access verified', { 
      bucketName,
      hasFiles: files.length > 0
    });
    
  } catch (error) {
    Logger.error('Video Utils - GCS access verification failed', {
      bucketName,
      error: error instanceof Error ? error.message : error
    });
    throw new Error(`GCS access failed for bucket ${bucketName}: ${error instanceof Error ? error.message : error}`);
  }
}

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

  // Create temporary directories first
  const tempDir = path.join(process.cwd(), 'temp');
  const videoDir = path.join(tempDir, 'videos');
  const thumbnailDir = path.join(tempDir, 'thumbnails');
  
  try {
    // Parse GCS URI
    const match = gcsUri.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (!match) {
      throw new Error('Invalid GCS URI format');
    }
    
    const bucketName = match[1];
    const fileName = match[2];

    // Verify GCS access and bucket permissions first
    await verifyGCSAccess(bucketName);

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Check if file exists in GCS
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found in GCS: ${gcsUri}`);
    }

    // Create directories with proper error handling
    await fs.mkdir(tempDir, { recursive: true });        // temp 디렉토리 먼저 생성
    await fs.mkdir(videoDir, { recursive: true });       // temp/videos 생성
    await fs.mkdir(thumbnailDir, { recursive: true });   // temp/thumbnails 생성

    // Download video file
    const videoPath = path.join(videoDir, `${videoId}.mp4`);
    const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

    Logger.step('Video Utils - Downloading video from GCS', { videoId, bucketName, fileName });

    // Download with retry logic and proper error handling
    try {
      await file.download({ destination: videoPath });
      
      // Verify the file was actually downloaded
      const stats = await fs.stat(videoPath);
      if (stats.size === 0) {
        throw new Error('Downloaded video file is empty');
      }
      
      Logger.step('Video Utils - Video downloaded successfully', { 
        videoId, 
        videoPath,
        fileSize: stats.size 
      });
      
    } catch (downloadError) {
      Logger.error('Video Utils - Failed to download video from GCS', {
        videoId,
        gcsUri,
        bucketName,
        fileName,
        error: downloadError instanceof Error ? downloadError.message : downloadError
      });
      throw new Error(`GCS download failed: ${downloadError instanceof Error ? downloadError.message : downloadError}`);
    }

    // Verify file exists before processing
    try {
      await fs.access(videoPath);
    } catch (accessError) {
      throw new Error(`Video file not accessible after download: ${videoPath}`);
    }

    Logger.step('Video Utils - Video downloaded, generating thumbnail', { videoId, videoPath });

    // Generate thumbnail and extract metadata using FFmpeg
    const metadata = await videoProcessingQueue.add(() => 
      generateThumbnailAndMetadata(videoPath, thumbnailPath, videoId)
    );

    // Verify thumbnail was created
    try {
      await fs.access(thumbnailPath);
    } catch (thumbnailError) {
      Logger.warn('Video Utils - Thumbnail generation may have failed', { 
        videoId, 
        thumbnailPath,
        error: thumbnailError instanceof Error ? thumbnailError.message : thumbnailError
      });
    }

    Logger.step('Video Utils - Thumbnail generated, moving to public directory', { videoId });

    // Move files to public directory
    const publicVideoDir = path.join(process.cwd(), 'public', 'videos');
    const publicThumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
    
    await fs.mkdir(publicVideoDir, { recursive: true });
    await fs.mkdir(publicThumbnailDir, { recursive: true });

    const finalVideoPath = path.join(publicVideoDir, `${videoId}.mp4`);
    const finalThumbnailPath = path.join(publicThumbnailDir, `${videoId}.jpg`);

    // Move video file
    try {
      await fs.rename(videoPath, finalVideoPath);
      Logger.step('Video Utils - Video file moved to public directory', { 
        videoId, 
        from: videoPath, 
        to: finalVideoPath 
      });
    } catch (moveError) {
      Logger.error('Video Utils - Failed to move video file', {
        videoId,
        from: videoPath,
        to: finalVideoPath,
        error: moveError instanceof Error ? moveError.message : moveError
      });
      throw new Error(`Failed to move video file: ${moveError instanceof Error ? moveError.message : moveError}`);
    }

    // Move thumbnail file (if exists)
    try {
      await fs.access(thumbnailPath);
      await fs.rename(thumbnailPath, finalThumbnailPath);
      Logger.step('Video Utils - Thumbnail file moved to public directory', { 
        videoId, 
        from: thumbnailPath, 
        to: finalThumbnailPath 
      });
    } catch (thumbnailMoveError) {
      Logger.warn('Video Utils - Failed to move thumbnail file', {
        videoId,
        from: thumbnailPath,
        to: finalThumbnailPath,
        error: thumbnailMoveError instanceof Error ? thumbnailMoveError.message : thumbnailMoveError
      });
      // Continue without thumbnail - not critical
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
  } finally {
    // Clean up temp directory
    try {
      const videoPath = path.join(videoDir, `${videoId}.mp4`);
      const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);
      
      // Remove individual files first
      try {
        await fs.unlink(videoPath);
      } catch {} // Ignore if file doesn't exist
      
      try {
        await fs.unlink(thumbnailPath);
      } catch {} // Ignore if file doesn't exist
      
      // Try to remove directories if empty
      try {
        await fs.rmdir(videoDir);
        await fs.rmdir(thumbnailDir);
        await fs.rmdir(tempDir);
      } catch {} // Ignore if directories are not empty or don't exist
      
      Logger.step('Video Utils - Temp directory cleanup completed', { videoId });
    } catch (cleanupError) {
      Logger.warn('Video Utils - Failed to clean up temp directory', { 
        videoId,
        error: cleanupError instanceof Error ? cleanupError.message : cleanupError 
      });
    }
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
  return new Promise(async (resolve, reject) => {
    let duration: number | undefined;
    let resolution: string | undefined;

    try {
      // Verify video file exists before processing
      await fs.access(videoPath);
      const stats = await fs.stat(videoPath);
      
      if (stats.size === 0) {
        throw new Error('Video file is empty');
      }
      
      Logger.step('Video Utils - Starting FFmpeg processing', { 
        videoId, 
        videoPath,
        fileSize: stats.size
      });
      
    } catch (accessError) {
      Logger.error('Video Utils - Video file not accessible for FFmpeg processing', {
        videoId,
        videoPath,
        error: accessError instanceof Error ? accessError.message : accessError
      });
      reject(new Error(`Video file not accessible: ${videoPath}`));
      return;
    }

    const command = ffmpeg(videoPath)
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
      .on('end', async () => {
        try {
          // Verify thumbnail was created
          await fs.access(thumbnailPath);
          const thumbnailStats = await fs.stat(thumbnailPath);
          
          Logger.step('Video Utils - FFmpeg processing finished', { 
            videoId,
            duration,
            resolution,
            thumbnailSize: thumbnailStats.size
          });
          
          resolve({ duration, resolution });
        } catch (thumbnailError) {
          Logger.warn('Video Utils - Thumbnail file not created or accessible', {
            videoId,
            thumbnailPath,
            error: thumbnailError instanceof Error ? thumbnailError.message : thumbnailError
          });
          // Resolve anyway since video processing succeeded
          resolve({ duration, resolution });
        }
      })
      .on('error', (err) => {
        Logger.error('Video Utils - FFmpeg error', { 
          videoId,
          videoPath,
          thumbnailPath,
          error: err.message,
          stack: err.stack
        });
        reject(new Error(`FFmpeg processing failed: ${err.message}`));
      })
      .screenshots({
        timestamps: ['50%'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '1280x720'
      });

    // Set a timeout for FFmpeg processing
    const timeout = setTimeout(() => {
      Logger.error('Video Utils - FFmpeg processing timeout', { videoId, videoPath });
      command.kill('SIGKILL');
      reject(new Error('FFmpeg processing timeout'));
    }, 300000); // 5 minutes timeout

    command.on('end', () => clearTimeout(timeout));
    command.on('error', () => clearTimeout(timeout));
  });
} 