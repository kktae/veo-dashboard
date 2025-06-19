import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import path from 'path';
import fs from 'fs/promises';
import { stat } from 'fs/promises';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /thumbnails/[id] - Serve thumbnail files directly
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const route = `/thumbnails/${id}`;
    
    Logger.apiStart(route, { id });

    // Extract thumbnail ID from filename (remove .jpg extension if present)
    const thumbnailId = id.replace(/\.jpg$/, '');
    const thumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', `${thumbnailId}.jpg`);

    // Check if file exists
    try {
      const stats = await stat(thumbnailPath);
      
      if (!stats.isFile()) {
        Logger.warn('Thumbnail file is not a regular file', { route, thumbnailPath });
        return NextResponse.json(
          { error: 'Thumbnail not found' },
          { status: 404 }
        );
      }

      // Read the file
      const fileBuffer = await fs.readFile(thumbnailPath);

      // Validate that we have actual content
      if (!fileBuffer || fileBuffer.length === 0) {
        Logger.warn('Thumbnail file is empty', { route, thumbnailPath });
        return NextResponse.json(
          { error: 'Thumbnail file is empty' },
          { status: 404 }
        );
      }

      const duration = Date.now() - startTime;
      Logger.apiSuccess(route, duration, { 
        thumbnailId, 
        fileSize: stats.size,
        path: thumbnailPath 
      });

      // Return the thumbnail file with proper headers
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'bytes',
        },
      });

    } catch (fileError) {
      Logger.warn('Thumbnail file not found or inaccessible', { 
        route, 
        thumbnailId, 
        thumbnailPath,
        error: fileError instanceof Error ? fileError.message : fileError
      });
      
      return NextResponse.json(
        { error: 'Thumbnail not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.apiError('Thumbnail API Error', duration, error);
    
    return NextResponse.json(
      { error: 'Failed to serve thumbnail' },
      { status: 500 }
    );
  }
} 