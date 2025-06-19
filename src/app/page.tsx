import { VideoDashboard } from '@/components/video-dashboard';
import { VideoSyncStatus } from '@/components/video-sync-status';

export default function Home() {
  return (
    <div className="space-y-8">
      <VideoDashboard />
      <div className="flex justify-center">
        <VideoSyncStatus />
      </div>
    </div>
  );
}
