import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import path from 'path';
import fs from 'fs/promises';
import { stat } from 'fs/promises';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /videos/[id] - Serve video files directly
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const { id } = await params;
  const route = `/videos/${id}`;
  
  try {
    Logger.apiStart(route, { id });

    // Extract video ID from filename (remove .mp4 extension if present)
    const videoId = id.replace(/\.mp4$/, '');
    const videoPath = path.join(process.cwd(), 'public', 'videos', `${videoId}.mp4`);

    // Check if file exists
    try {
      const stats = await stat(videoPath);
      
      if (!stats.isFile()) {
        Logger.warn('Video file is not a regular file', { route, videoPath });
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      // Handle range requests for video streaming
      const range = request.headers.get('range');
      const fileSize = stats.size;

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        // Read the requested chunk
        const fileHandle = await fs.open(videoPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();

        const duration = Date.now() - startTime;
        Logger.apiSuccess(route, duration, { 
          videoId, 
          fileSize,
          rangeStart: start,
          rangeEnd: end,
          chunkSize,
          path: videoPath 
        });

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } else {
        // Return the entire file
        const fileBuffer = await fs.readFile(videoPath);

        const duration = Date.now() - startTime;
        Logger.apiSuccess(route, duration, { 
          videoId, 
          fileSize: stats.size,
          path: videoPath 
        });

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Accept-Ranges': 'bytes',
          },
        });
      }

    } catch (fileError) {
      Logger.warn('Video file not found or inaccessible', { 
        route, 
        videoId, 
        videoPath,
        error: fileError instanceof Error ? fileError.message : fileError
      });
      
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError(route, duration, error);
    
    return NextResponse.json(
      { error: 'Failed to serve video' },
      { status: 500 }
    );
  }
} 