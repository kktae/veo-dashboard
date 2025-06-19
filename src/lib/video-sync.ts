import { Storage } from '@google-cloud/storage';
import { getDatabase } from './database';
import { downloadAndProcessVideo } from './video-server-utils';
import { validateResolution } from './video-utils';
import { Logger } from './logger';
import path from 'path';
import fs from 'fs/promises';

export interface VideoSyncStatus {
  videoId: string;
  status: 'synced' | 'downloading' | 'error' | 'missing_gcs';
  localVideoPath?: string;
  localThumbnailPath?: string;
  error?: string;
}

class VideoSyncService {
  private storage: Storage;
  private isInitialized = false;
  private syncStatus = new Map<string, VideoSyncStatus>();
  private downloadQueue = new Set<string>();

  constructor() {
    this.storage = new Storage();
  }

  /**
   * 서버 시작 시 호출되는 초기화 함수
   * DB의 모든 비디오를 확인하고 누락된 파일들을 비동기로 다운로드
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      Logger.warn('Video Sync Service already initialized');
      return;
    }

    Logger.step('Video Sync Service - Starting initialization');

    try {
      const db = await getDatabase();
      
      // DB에서 완료된 비디오들 중 GCS URI가 있는 것들 조회
      const completedVideos = await db.getVideosByStatus('completed');
      const videosWithGcs = completedVideos.filter(video => video.gcs_uri);

      Logger.step('Video Sync Service - Found videos to check', {
        totalCompleted: completedVideos.length,
        withGcsUri: videosWithGcs.length
      });

      // 로컬 디렉토리 생성
      await this.ensureDirectories();

      // 각 비디오에 대해 로컬 파일 존재 여부 확인 및 다운로드
      const syncPromises = videosWithGcs.map(video => 
        this.checkAndSyncVideo(video.id, video.gcs_uri!)
      );

      // 모든 동기화 작업을 병렬로 시작 (비동기)
      Promise.allSettled(syncPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        Logger.step('Video Sync Service - Initialization completed', {
          totalVideos: videosWithGcs.length,
          successful,
          failed
        });
      });

      this.isInitialized = true;

    } catch (error) {
      Logger.error('Video Sync Service - Initialization failed', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * 개별 비디오 파일 확인 및 동기화
   */
  private async checkAndSyncVideo(videoId: string, gcsUri: string): Promise<void> {
    try {
      const localVideoPath = path.join(process.cwd(), 'public', 'videos', `${videoId}.mp4`);
      const localThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${videoId}.jpg`);

      // 로컬 파일 존재 여부 확인
      const videoExists = await this.fileExists(localVideoPath);
      const thumbnailExists = await this.fileExists(localThumbnailPath);

      if (videoExists && thumbnailExists) {
        // 파일이 이미 존재하는 경우
        this.syncStatus.set(videoId, {
          videoId,
          status: 'synced',
          localVideoPath,
          localThumbnailPath
        });
        
        Logger.debug('Video Sync Service - Video already exists locally', {
          videoId,
          localVideoPath,
          localThumbnailPath
        });
        return;
      }

      // 파일이 없거나 일부만 있는 경우 다운로드
      if (!this.downloadQueue.has(videoId)) {
        this.downloadQueue.add(videoId);
        await this.downloadVideo(videoId, gcsUri);
      }

    } catch (error) {
      this.syncStatus.set(videoId, {
        videoId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });

      Logger.error('Video Sync Service - Failed to sync video', {
        videoId,
        gcsUri,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * 비디오 다운로드 및 처리
   */
  private async downloadVideo(videoId: string, gcsUri: string): Promise<void> {
    try {
      // 다운로드 상태로 업데이트
      this.syncStatus.set(videoId, {
        videoId,
        status: 'downloading'
      });

      Logger.step('Video Sync Service - Starting download', {
        videoId,
        gcsUri: gcsUri.substring(0, 50) + '...'
      });

      // 기존 video-utils의 다운로드 및 처리 함수 활용
      const result = await downloadAndProcessVideo(gcsUri, videoId);

      // DB 업데이트 (해상도 값 검증 후 저장)
      const db = await getDatabase();
      const validResolution = validateResolution(result.resolution, videoId);
      
      if (result.resolution && !validResolution) {
        Logger.warn('Video Sync Service - Invalid resolution detected, not saving to DB', {
          videoId,
          invalidResolution: result.resolution
        });
      }
      
      await db.updateVideo(videoId, {
        video_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl,
        duration: result.duration,
        resolution: validResolution
      });

      // 성공 상태로 업데이트
      this.syncStatus.set(videoId, {
        videoId,
        status: 'synced',
        localVideoPath: path.join(process.cwd(), 'public', 'videos', `${videoId}.mp4`),
        localThumbnailPath: path.join(process.cwd(), 'public', 'thumbnails', `${videoId}.jpg`)
      });

      Logger.step('Video Sync Service - Download completed', {
        videoId,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl
      });

    } catch (error) {
      this.syncStatus.set(videoId, {
        videoId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });

      Logger.error('Video Sync Service - Download failed', {
        videoId,
        gcsUri,
        error: error instanceof Error ? error.message : error
      });
    } finally {
      this.downloadQueue.delete(videoId);
    }
  }

  /**
   * 필요한 디렉토리 생성
   */
  private async ensureDirectories(): Promise<void> {
    const videosDir = path.join(process.cwd(), 'public', 'videos');
    const thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    
    await fs.mkdir(videosDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });
    
    Logger.debug('Video Sync Service - Directories ensured', {
      videosDir,
      thumbnailsDir
    });
  }

  /**
   * 파일 존재 여부 확인
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 특정 비디오의 동기화 상태 조회
   */
  getSyncStatus(videoId: string): VideoSyncStatus | undefined {
    return this.syncStatus.get(videoId);
  }

  /**
   * 모든 비디오의 동기화 상태 조회
   */
  getAllSyncStatus(): VideoSyncStatus[] {
    return Array.from(this.syncStatus.values());
  }

  /**
   * 새로운 비디오가 완료되었을 때 호출되는 함수
   * 외부에서 비디오 생성이 완료되면 이 함수를 호출하여 즉시 동기화
   */
  async syncNewVideo(videoId: string, gcsUri: string): Promise<void> {
    if (!this.isInitialized) {
      Logger.warn('Video Sync Service not initialized, skipping sync', { videoId });
      return;
    }

    Logger.step('Video Sync Service - Syncing new video', { videoId, gcsUri });
    await this.checkAndSyncVideo(videoId, gcsUri);
  }

  /**
   * 서비스 종료 시 정리
   */
  async shutdown(): Promise<void> {
    Logger.step('Video Sync Service - Shutting down');
    this.downloadQueue.clear();
    this.syncStatus.clear();
    this.isInitialized = false;
  }
}

// 싱글톤 인스턴스
let videoSyncServiceInstance: VideoSyncService | null = null;

/**
 * 비디오 동기화 서비스 인스턴스 반환
 */
export function getVideoSyncService(): VideoSyncService {
  if (!videoSyncServiceInstance) {
    videoSyncServiceInstance = new VideoSyncService();
  }
  return videoSyncServiceInstance;
}

/**
 * 서버 시작 시 호출할 초기화 함수
 */
export async function initializeVideoSync(): Promise<void> {
  const service = getVideoSyncService();
  await service.initialize();
}

/**
 * 새로운 비디오 동기화 (외부에서 호출)
 */
export async function syncNewVideo(videoId: string, gcsUri: string): Promise<void> {
  const service = getVideoSyncService();
  await service.syncNewVideo(videoId, gcsUri);
}

/**
 * 동기화 상태 조회
 */
export function getVideoSyncStatus(videoId?: string): VideoSyncStatus | VideoSyncStatus[] | undefined {
  const service = getVideoSyncService();
  if (videoId) {
    return service.getSyncStatus(videoId);
  }
  return service.getAllSyncStatus();
} 