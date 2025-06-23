import { VideoSyncStatus } from '@/components/video-sync-status';
import { AdminControlPanel } from '@/components/admin-control-panel';

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-600 mt-2">
          시스템 관리 및 비디오 동기화 상태를 확인할 수 있습니다.
        </p>
      </div>
      
      <div className="space-y-8">
        <div className="flex justify-center">
          <VideoSyncStatus />
        </div>
        <div className="flex justify-center">
          <AdminControlPanel />
        </div>
      </div>
    </div>
  );
} 