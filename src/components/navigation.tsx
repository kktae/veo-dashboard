'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, Shield, Video } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Video className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">VEO Dashboard</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={pathname === '/' ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link href="/" className="flex items-center space-x-2">
                <Home className="h-4 w-4" />
                <span>홈</span>
              </Link>
            </Button>
            
            <Button
              variant={pathname === '/admin' ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href="/admin" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>관리자</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
} 