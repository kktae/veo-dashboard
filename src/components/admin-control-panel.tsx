'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Shield, Eye, EyeOff } from 'lucide-react';

interface AdminControlPanelProps {
  onFeatureStatusChange?: (enabled: boolean) => void;
}

export function AdminControlPanel({ onFeatureStatusChange }: AdminControlPanelProps) {
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoGenerationEnabled, setVideoGenerationEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 컴포넌트 마운트 시 현재 기능 상태 확인
  useEffect(() => {
    checkCurrentStatus();
  }, []);

  const checkCurrentStatus = async () => {
    try {
      const response = await fetch('/api/admin/toggle-feature', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setVideoGenerationEnabled(data.videoGenerationEnabled);
      }
    } catch (error) {
      console.error('Failed to check feature status:', error);
    }
  };

  const handleToggleFeature = async (action: 'enable' | 'disable') => {
    if (!adminKey.trim()) {
      setMessage({ type: 'error', text: '관리자 키를 입력해주세요.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/toggle-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey, action }),
      });

      const data = await response.json();

      if (response.ok) {
        setVideoGenerationEnabled(data.videoGenerationEnabled);
        setIsAuthenticated(true);
        setMessage({ 
          type: 'success', 
          text: `비디오 생성 기능이 ${data.videoGenerationEnabled ? '활성화' : '비활성화'}되었습니다.` 
        });
        onFeatureStatusChange?.(data.videoGenerationEnabled);
      } else {
        setIsAuthenticated(false);
        setMessage({ type: 'error', text: data.error || '작업 실행에 실패했습니다.' });
      }
    } catch (error) {
      setIsAuthenticated(false);
      setMessage({ type: 'error', text: '서버 연결에 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!adminKey.trim()) {
      setMessage({ type: 'error', text: '관리자 키를 입력해주세요.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/toggle-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey, action: 'status' }),
      });

      const data = await response.json();

      if (response.ok) {
        setVideoGenerationEnabled(data.videoGenerationEnabled);
        setIsAuthenticated(true);
        setMessage({ 
          type: 'success', 
          text: `현재 비디오 생성 기능은 ${data.videoGenerationEnabled ? '활성화' : '비활성화'} 상태입니다.` 
        });
      } else {
        setIsAuthenticated(false);
        setMessage({ type: 'error', text: data.error || '상태 확인에 실패했습니다.' });
      }
    } catch (error) {
      setIsAuthenticated(false);
      setMessage({ type: 'error', text: '서버 연결에 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Shield className="h-5 w-5" />
          관리자 제어 패널
        </CardTitle>
        <CardDescription className="text-amber-700">
          관리자 전용 키를 사용하여 비디오 생성 기능을 제어할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 현재 상태 표시 */}
        {videoGenerationEnabled !== null && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <span className="font-medium">현재 비디오 생성 상태:</span>
            <Badge 
              variant={videoGenerationEnabled ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {videoGenerationEnabled ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {videoGenerationEnabled ? '활성화' : '비활성화'}
            </Badge>
          </div>
        )}

        {/* 관리자 키 입력 */}
        <div className="space-y-2">
          <Label htmlFor="admin-key">관리자 키</Label>
          <div className="relative">
            <Input
              id="admin-key"
              type={showKey ? "text" : "password"}
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="관리자 키를 입력하세요"
              disabled={isLoading}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2"
              onClick={() => setShowKey(!showKey)}
              disabled={isLoading}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* 메시지 표시 */}
        {message && (
          <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* 제어 버튼들 */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={handleCheckStatus}
            variant="outline"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            상태 확인
          </Button>

          <Button
            onClick={() => handleToggleFeature('enable')}
            variant="default"
            disabled={isLoading || (isAuthenticated && videoGenerationEnabled === true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            기능 활성화
          </Button>

          <Button
            onClick={() => handleToggleFeature('disable')}
            variant="destructive"
            disabled={isLoading || (isAuthenticated && videoGenerationEnabled === false)}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            기능 비활성화
          </Button>
        </div>

        {/* 주의사항 */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-800 text-sm">
            <strong>주의:</strong> 비디오 생성 기능을 비활성화하면 모든 사용자의 새로운 비디오 생성 요청이 차단됩니다. 
            진행 중인 생성 작업은 계속 진행됩니다.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
} 