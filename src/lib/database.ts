import { Pool } from 'pg';
import { Logger } from './logger';

export interface VideoRecord {
  id: string;
  korean_prompt: string;
  english_prompt: string;
  user_email: string;
  status: 'pending' | 'translating' | 'generating' | 'processing' | 'completed' | 'error';
  video_url?: string;
  thumbnail_url?: string;
  gcs_uri?: string;
  duration?: number;
  resolution?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

class VideoDatabase {
  private pool: Pool;

  constructor() {
    try {
      // PostgreSQL connection configuration
      const connectionConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'veo_dashboard',
        user: process.env.POSTGRES_USER || 'veo_user',
        password: process.env.POSTGRES_PASSWORD || 'veo_password',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        ssl: false,
      };

      Logger.info('Initializing PostgreSQL database', { 
        host: connectionConfig.host, 
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.user
      });
      
      this.pool = new Pool(connectionConfig);
      
      // Test connection
      this.pool.on('connect', () => {
        Logger.debug('PostgreSQL client connected');
      });

      this.pool.on('error', (err: Error) => {
        Logger.error('PostgreSQL pool error', { error: err.message });
      });

      this.init();
      
      Logger.info('PostgreSQL database initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize PostgreSQL database', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`PostgreSQL database initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async init() {
    try {
      // Create videos table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS videos (
          id VARCHAR(255) PRIMARY KEY,
          korean_prompt TEXT NOT NULL,
          english_prompt TEXT DEFAULT '',
          user_email VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          video_url TEXT,
          thumbnail_url TEXT,
          gcs_uri TEXT,
          duration INTEGER,
          resolution VARCHAR(50),
          error_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        )
      `;
      
      await this.pool.query(createTableSQL);
      
      // Create admin_settings table if it doesn't exist
      const createAdminSettingsTableSQL = `
        CREATE TABLE IF NOT EXISTS admin_settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.pool.query(createAdminSettingsTableSQL);
      
      // Add gcs_uri column if it doesn't exist (for existing tables)
      const addGcsUriColumnSQL = `
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS gcs_uri TEXT;
      `;
      
      await this.pool.query(addGcsUriColumnSQL);
      
      // Add user_email column if it doesn't exist (for existing tables)
      const addUserEmailColumnSQL = `
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
      `;
      
      await this.pool.query(addUserEmailColumnSQL);
      
      // Create indexes for better query performance
      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
        CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);
      `;
      
      await this.pool.query(createIndexSQL);
      
      // Initialize default admin settings if they don't exist
      await this.initializeDefaultAdminSettings();
      
      Logger.info('PostgreSQL database tables and indexes created');
    } catch (error) {
      Logger.error('Failed to initialize PostgreSQL database schema', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private async initializeDefaultAdminSettings() {
    try {
      // Initialize video generation enabled setting
      const checkSettingSQL = 'SELECT * FROM admin_settings WHERE key = $1';
      const videoGenResult = await this.pool.query(checkSettingSQL, ['video_generation_enabled']);
      
      if (videoGenResult.rows.length === 0) {
        const insertSettingSQL = `
          INSERT INTO admin_settings (key, value, description, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `;
        
        await this.pool.query(insertSettingSQL, [
          'video_generation_enabled',
          'true',
          'Controls whether video generation feature is enabled for users'
        ]);
        
        Logger.info('Default admin setting initialized: video_generation_enabled = true');
      }
    } catch (error) {
      Logger.error('Failed to initialize default admin settings', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  // Insert new video record
  async insertVideo(video: Omit<VideoRecord, 'created_at'> & { created_at?: string }): Promise<VideoRecord> {
    const insertSQL = `
      INSERT INTO videos (
        id, korean_prompt, english_prompt, user_email, status, video_url, 
        thumbnail_url, gcs_uri, duration, resolution, error_message, 
        created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const createdAt = video.created_at || new Date().toISOString();
    
    try {
      const result = await this.pool.query(insertSQL, [
        video.id,
        video.korean_prompt,
        video.english_prompt,
        video.user_email,
        video.status,
        video.video_url || null,
        video.thumbnail_url || null,
        video.gcs_uri || null,
        video.duration || null,
        video.resolution || null,
        video.error_message || null,
        createdAt,
        video.completed_at || null
      ]);
      
      const record = result.rows[0] as VideoRecord;
      Logger.step('Database - Video record inserted', { id: record.id });
      return record;
    } catch (error) {
      Logger.error('Database - Failed to insert video record', { 
        id: video.id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Update video record
  async updateVideo(id: string, updates: Partial<Omit<VideoRecord, 'id' | 'created_at'>>): Promise<VideoRecord | null> {
    const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    if (fields.length === 0) return this.getVideo(id);
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const updateSQL = `UPDATE videos SET ${setClause} WHERE id = $1 RETURNING *`;
    
    try {
      const values = [id, ...fields.map(field => updates[field as keyof typeof updates])];
      const result = await this.pool.query(updateSQL, values);
      
      if (result.rows.length > 0) {
        const record = result.rows[0] as VideoRecord;
        Logger.step('Database - Video record updated', { id, fields });
        return record;
      } else {
        Logger.warn('Database - No video record found to update', { id });
        return null;
      }
    } catch (error) {
      Logger.error('Database - Failed to update video record', { 
        id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get single video record
  async getVideo(id: string): Promise<VideoRecord | null> {
    const selectSQL = 'SELECT * FROM videos WHERE id = $1';
    
    try {
      const result = await this.pool.query(selectSQL, [id]);
      
      if (result.rows.length > 0) {
        const record = result.rows[0] as VideoRecord;
        Logger.debug('Database - Video record retrieved', { id });
        return record;
      } else {
        Logger.debug('Database - Video record not found', { id });
        return null;
      }
    } catch (error) {
      Logger.error('Database - Failed to get video record', { 
        id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get all video records with pagination
  async getVideos(limit: number = 50, offset: number = 0): Promise<VideoRecord[]> {
    const selectSQL = `
      SELECT * FROM videos 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    try {
      const result = await this.pool.query(selectSQL, [limit, offset]);
      const records = result.rows as VideoRecord[];
      
      Logger.debug('Database - Video records retrieved', { 
        count: records.length, 
        limit, 
        offset 
      });
      
      return records;
    } catch (error) {
      Logger.error('Database - Failed to get video records', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get all video records with pagination and total count
  async getVideosWithCount(limit: number = 50, offset: number = 0): Promise<{
    videos: VideoRecord[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const selectSQL = `
      SELECT * FROM videos 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const countSQL = `SELECT COUNT(*) as total FROM videos`;
    
    try {
      const [videosResult, countResult] = await Promise.all([
        this.pool.query(selectSQL, [limit, offset]),
        this.pool.query(countSQL)
      ]);
      
      const records = videosResult.rows as VideoRecord[];
      const totalCount = parseInt(countResult.rows[0].total);
      const hasMore = offset + records.length < totalCount;
      
      Logger.debug('Database - Video records with count retrieved', { 
        count: records.length, 
        totalCount,
        limit, 
        offset,
        hasMore
      });
      
      return {
        videos: records,
        totalCount,
        hasMore
      };
    } catch (error) {
      Logger.error('Database - Failed to get video records with count', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get videos by their IDs
  async getVideosByIds(ids: string[]): Promise<VideoRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    
    const selectSQL = `
      SELECT * FROM videos 
      WHERE id = ANY($1::varchar[])
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await this.pool.query(selectSQL, [ids]);
      const records = result.rows as VideoRecord[];
      
      Logger.debug('Database - Video records retrieved by IDs', { 
        count: records.length,
        requested: ids.length 
      });
      
      return records;
    } catch (error) {
      Logger.error('Database - Failed to get video records by IDs', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get videos by status
  async getVideosByStatus(status: VideoRecord['status']): Promise<VideoRecord[]> {
    const selectSQL = `
      SELECT * FROM videos 
      WHERE status = $1 
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await this.pool.query(selectSQL, [status]);
      const records = result.rows as VideoRecord[];
      
      Logger.debug('Database - Video records by status retrieved', { 
        status, 
        count: records.length 
      });
      
      return records;
    } catch (error) {
      Logger.error('Database - Failed to get video records by status', { 
        status, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Delete single video record
  async deleteVideo(id: string): Promise<boolean> {
    const deleteSQL = 'DELETE FROM videos WHERE id = $1';
    
    try {
      const result = await this.pool.query(deleteSQL, [id]);
      const success = (result.rowCount ?? 0) > 0;
      
      if (success) {
        Logger.step('Database - Video record deleted', { id });
      } else {
        Logger.warn('Database - No video record found to delete', { id });
      }
      
      return success;
    } catch (error) {
      Logger.error('Database - Failed to delete video record', { 
        id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Delete multiple video records by their IDs
  async deleteVideos(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    
    const deleteSQL = 'DELETE FROM videos WHERE id = ANY($1::varchar[])';
    
    try {
      const result = await this.pool.query(deleteSQL, [ids]);
      const deletedCount = result.rowCount ?? 0;
      
      Logger.step('Database - Multiple video records deleted', { 
        count: deletedCount, 
        requested: ids.length 
      });
      
      return deletedCount;
    } catch (error) {
      Logger.error('Database - Failed to delete multiple video records', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  // Clear all video records
  async clearAllVideos(): Promise<number> {
    const deleteSQL = 'TRUNCATE TABLE videos RESTART IDENTITY';
    
    try {
      const result = await this.pool.query(deleteSQL);
      const deletedCount = result.rowCount || 0;
      
      Logger.info('Database - All video records cleared', { deletedCount });
      return deletedCount;
    } catch (error) {
      Logger.error('Database - Failed to clear all video records', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get database statistics
  async getStats(): Promise<{ totalVideos: number; completedVideos: number; errorVideos: number }> {
    const statsSQL = `
      SELECT 
        COUNT(*) as total_videos,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_videos,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_videos
      FROM videos
    `;
    
    try {
      const result = await this.pool.query(statsSQL);
      const stats = result.rows[0];
      
      return {
        totalVideos: parseInt(stats.total_videos),
        completedVideos: parseInt(stats.completed_videos),
        errorVideos: parseInt(stats.error_videos)
      };
    } catch (error) {
      Logger.error('Database - Failed to get stats', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Admin Settings Management
  async getAdminSetting(key: string): Promise<AdminSetting | null> {
    const selectSQL = 'SELECT * FROM admin_settings WHERE key = $1';
    
    try {
      const result = await this.pool.query(selectSQL, [key]);
      
      if (result.rows.length > 0) {
        const setting = result.rows[0] as AdminSetting;
        Logger.debug('Database - Admin setting retrieved', { key, value: setting.value });
        return setting;
      } else {
        Logger.debug('Database - Admin setting not found', { key });
        return null;
      }
    } catch (error) {
      Logger.error('Database - Failed to get admin setting', { 
        key, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async setAdminSetting(key: string, value: string, description?: string): Promise<AdminSetting> {
    const upsertSQL = `
      INSERT INTO admin_settings (key, value, description, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = COALESCE(EXCLUDED.description, admin_settings.description),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    try {
      const result = await this.pool.query(upsertSQL, [key, value, description]);
      const setting = result.rows[0] as AdminSetting;
      
      Logger.step('Database - Admin setting updated', { key, value, description });
      return setting;
    } catch (error) {
      Logger.error('Database - Failed to set admin setting', { 
        key, 
        value, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async getAllAdminSettings(): Promise<AdminSetting[]> {
    const selectSQL = 'SELECT * FROM admin_settings ORDER BY key';
    
    try {
      const result = await this.pool.query(selectSQL);
      const settings = result.rows as AdminSetting[];
      
      Logger.debug('Database - All admin settings retrieved', { count: settings.length });
      return settings;
    } catch (error) {
      Logger.error('Database - Failed to get all admin settings', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async deleteAdminSetting(key: string): Promise<boolean> {
    const deleteSQL = 'DELETE FROM admin_settings WHERE key = $1';
    
    try {
      const result = await this.pool.query(deleteSQL, [key]);
      const deleted = (result.rowCount ?? 0) > 0;
      
      if (deleted) {
        Logger.step('Database - Admin setting deleted', { key });
      } else {
        Logger.warn('Database - No admin setting found to delete', { key });
      }
      
      return deleted;
    } catch (error) {
      Logger.error('Database - Failed to delete admin setting', { 
        key, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Video Generation Feature Control
  async isVideoGenerationEnabled(): Promise<boolean> {
    try {
      const setting = await this.getAdminSetting('video_generation_enabled');
      return setting ? setting.value.toLowerCase() === 'true' : true; // Default to enabled
    } catch (error) {
      Logger.error('Database - Failed to check video generation status', { 
        error: error instanceof Error ? error.message : error 
      });
      return true; // Default to enabled on error
    }
  }

  async setVideoGenerationEnabled(enabled: boolean): Promise<void> {
    try {
      await this.setAdminSetting(
        'video_generation_enabled',
        enabled.toString(),
        'Controls whether video generation feature is enabled for users'
      );
      Logger.step('Database - Video generation setting updated', { enabled });
    } catch (error) {
      Logger.error('Database - Failed to set video generation status', { 
        enabled,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Close database connection
  async close(): Promise<void> {
    await this.pool.end();
    Logger.info('Database connection closed');
  }
}

// Singleton instance
let dbInstance: VideoDatabase | null = null;
let initializationError: Error | null = null;

export async function getDatabase(): Promise<VideoDatabase> {
  if (initializationError) {
    throw initializationError;
  }
  
  if (!dbInstance) {
    try {
      dbInstance = new VideoDatabase();
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error('Unknown database initialization error');
      Logger.error('Database initialization failed in getDatabase', {
        error: initializationError.message,
        stack: initializationError.stack
      });
      throw initializationError;
    }
  }
  return dbInstance;
}

// Export utility functions
export async function updateVideoRecord(id: string, updates: Partial<Omit<VideoRecord, 'id' | 'created_at'>>): Promise<VideoRecord | null> {
  const db = await getDatabase();
  return db.updateVideo(id, updates);
}

export async function getVideoRecord(id: string): Promise<VideoRecord | null> {
  const db = await getDatabase();
  return db.getVideo(id);
}

export async function insertVideoRecord(video: Omit<VideoRecord, 'created_at'> & { created_at?: string }): Promise<VideoRecord> {
  const db = await getDatabase();
  return db.insertVideo(video);
}

export async function getVideoRecords(limit?: number, offset?: number): Promise<VideoRecord[]> {
  const db = await getDatabase();
  return db.getVideos(limit, offset);
}

export async function getVideoRecordsWithCount(limit?: number, offset?: number): Promise<{
  videos: VideoRecord[];
  totalCount: number;
  hasMore: boolean;
}> {
  const db = await getDatabase();
  return db.getVideosWithCount(limit, offset);
}

export async function deleteVideoRecord(id: string): Promise<boolean> {
  const db = await getDatabase();
  return db.deleteVideo(id);
}

export async function clearAllVideoRecords(): Promise<number> {
  const db = await getDatabase();
  return db.clearAllVideos();
}

// Admin Settings utility functions
export async function getAdminSetting(key: string): Promise<AdminSetting | null> {
  const db = await getDatabase();
  return db.getAdminSetting(key);
}

export async function setAdminSetting(key: string, value: string, description?: string): Promise<AdminSetting> {
  const db = await getDatabase();
  return db.setAdminSetting(key, value, description);
}

export async function getAllAdminSettings(): Promise<AdminSetting[]> {
  const db = await getDatabase();
  return db.getAllAdminSettings();
}

export async function deleteAdminSetting(key: string): Promise<boolean> {
  const db = await getDatabase();
  return db.deleteAdminSetting(key);
}

// Video Generation Feature Control utility functions
export async function isVideoGenerationEnabled(): Promise<boolean> {
  const db = await getDatabase();
  return db.isVideoGenerationEnabled();
}

export async function setVideoGenerationEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  return db.setVideoGenerationEnabled(enabled);
} 