import { VideoDashboard } from '@/components/video-dashboard';
import { VideoSyncStatus } from '@/components/video-sync-status';
import { AdminControlPanel } from '@/components/admin-control-panel';

export default function Home() {
  return (
    <div className="space-y-8">
      <VideoDashboard />
      <div className="flex justify-center">
        <VideoSyncStatus />
      </div>
      <div className="flex justify-center">
        <AdminControlPanel />
      </div>
    </div>
  );
}
