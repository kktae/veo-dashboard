import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Log requests to thumbnails and videos to help debug ERR_EMPTY_RESPONSE
  if (pathname.startsWith('/thumbnails/') || pathname.startsWith('/videos/') || pathname === '/favicon.ico') {
    console.log(`[MIDDLEWARE] ${request.method} ${pathname} - User-Agent: ${request.headers.get('user-agent')?.substring(0, 100)}`);
    console.log(`[MIDDLEWARE] Headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/thumbnails/:path*',
    '/videos/:path*',
    '/favicon.ico'
  ]
}; 