import { Database } from 'bun:sqlite';
import path from 'path';
import { Logger } from './logger';

export interface VideoRecord {
  id: string;
  korean_prompt: string;
  english_prompt: string;
  status: 'pending' | 'translating' | 'generating' | 'processing' | 'completed' | 'error';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  resolution?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

class VideoDatabase {
  private db: Database;

  constructor() {
    try {
      // SQLite database path from environment variable or default
      const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'veo-meta.sqlite');
      Logger.info('Initializing database', { dbPath });
      
      this.db = new Database(dbPath, { create: true });
      Logger.info('Database instance created', { dbPath });

      this.init();
      
      Logger.info('Database initialized successfully', { dbPath });
    } catch (error) {
      Logger.error('Failed to initialize database', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private init() {
    // Enable WAL mode for better performance
    this.db.run('PRAGMA journal_mode = WAL');
    
    // Create videos table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        korean_prompt TEXT NOT NULL,
        english_prompt TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        video_url TEXT,
        thumbnail_url TEXT,
        duration INTEGER,
        resolution TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      )
    `;
    
    this.db.run(createTableSQL);
    
    // Create index for better query performance
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
    `;
    
    this.db.run(createIndexSQL);
    
    Logger.info('Database tables and indexes created');
  }

  // Insert new video record
  insertVideo(video: Omit<VideoRecord, 'created_at'> & { created_at?: string }): VideoRecord {
    const insertSQL = `
      INSERT INTO videos (
        id, korean_prompt, english_prompt, status, video_url, 
        thumbnail_url, duration, resolution, error_message, 
        created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const createdAt = video.created_at || new Date().toISOString();
    const record: VideoRecord = {
      ...video,
      created_at: createdAt
    };
    
    try {
      const stmt = this.db.query(insertSQL);
      stmt.run(
        record.id,
        record.korean_prompt,
        record.english_prompt,
        record.status,
        record.video_url || null,
        record.thumbnail_url || null,
        record.duration || null,
        record.resolution || null,
        record.error_message || null,
        record.created_at,
        record.completed_at || null
      );
      
      Logger.step('Database - Video record inserted', { id: record.id });
      return record;
    } catch (error) {
      Logger.error('Database - Failed to insert video record', { 
        id: record.id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Update video record
  updateVideo(id: string, updates: Partial<Omit<VideoRecord, 'id' | 'created_at'>>): VideoRecord | null {
    const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    if (fields.length === 0) return this.getVideo(id);
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateSQL = `UPDATE videos SET ${setClause} WHERE id = ?`;
    
    try {
      const stmt = this.db.query(updateSQL);
      const values = fields.map(field => updates[field as keyof typeof updates]).filter((val): val is NonNullable<typeof val> => val !== undefined);
      values.push(id);
      
      const result = stmt.run(...values);
      
      if (result.changes > 0) {
        Logger.step('Database - Video record updated', { id, fields });
        return this.getVideo(id);
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
  getVideo(id: string): VideoRecord | null {
    const selectSQL = 'SELECT * FROM videos WHERE id = ?';
    
    try {
      const stmt = this.db.query(selectSQL);
      const record = stmt.get(id) as VideoRecord | undefined;
      
      if (record) {
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
  getVideos(limit: number = 50, offset: number = 0): VideoRecord[] {
    const selectSQL = `
      SELECT * FROM videos 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    try {
      const stmt = this.db.query(selectSQL);
      const records = stmt.all(limit, offset) as VideoRecord[];
      
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

  // Get videos by status
  getVideosByStatus(status: VideoRecord['status']): VideoRecord[] {
    const selectSQL = 'SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC';
    
    try {
      const stmt = this.db.query(selectSQL);
      const records = stmt.all(status) as VideoRecord[];
      
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

  // Delete video record
  deleteVideo(id: string): boolean {
    const deleteSQL = 'DELETE FROM videos WHERE id = ?';
    
    try {
      const stmt = this.db.query(deleteSQL);
      const result = stmt.run(id);
      
      const deleted = result.changes > 0;
      if (deleted) {
        Logger.step('Database - Video record deleted', { id });
      } else {
        Logger.warn('Database - No video record found to delete', { id });
      }
      
      return deleted;
    } catch (error) {
      Logger.error('Database - Failed to delete video record', { 
        id, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Delete all video records
  clearAllVideos(): number {
    const deleteSQL = 'DELETE FROM videos';
    
    try {
      const stmt = this.db.query(deleteSQL);
      const result = stmt.run();
      
      Logger.info('Database - All video records cleared', { deletedCount: result.changes });
      return result.changes;
    } catch (error) {
      Logger.error('Database - Failed to clear all video records', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Get database statistics
  getStats(): { totalVideos: number; completedVideos: number; errorVideos: number } {
    try {
      const totalStmt = this.db.query('SELECT COUNT(*) as count FROM videos');
      const completedStmt = this.db.query('SELECT COUNT(*) as count FROM videos WHERE status = ?');
      const errorStmt = this.db.query('SELECT COUNT(*) as count FROM videos WHERE status = ?');
      
      const total = (totalStmt.get() as { count: number }).count;
      const completed = (completedStmt.get('completed') as { count: number }).count;
      const error = (errorStmt.get('error') as { count: number }).count;
      
      return {
        totalVideos: total,
        completedVideos: completed,
        errorVideos: error
      };
    } catch (error) {
      Logger.error('Database - Failed to get statistics', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  // Close database connection
  close(): void {
    this.db.close();
    Logger.info('Database connection closed');
  }
}

// Singleton instance
let dbInstance: VideoDatabase | null = null;
let initializationError: Error | null = null;

export function getDatabase(): VideoDatabase {
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

// Helper functions for convenience
export function updateVideoRecord(id: string, updates: Partial<Omit<VideoRecord, 'id' | 'created_at'>>): VideoRecord | null {
  return getDatabase().updateVideo(id, updates);
}

export function getVideoRecord(id: string): VideoRecord | null {
  return getDatabase().getVideo(id);
}

export function insertVideoRecord(video: Omit<VideoRecord, 'created_at'> & { created_at?: string }): VideoRecord {
  return getDatabase().insertVideo(video);
}

export function getVideoRecords(limit?: number, offset?: number): VideoRecord[] {
  return getDatabase().getVideos(limit, offset);
}

export function deleteVideoRecord(id: string): boolean {
  return getDatabase().deleteVideo(id);
}

export function clearAllVideoRecords(): number {
  return getDatabase().clearAllVideos();
}

export { VideoDatabase }; 