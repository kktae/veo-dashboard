'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Maximize, Download, X } from 'lucide-react';
import { VideoGenerationResult } from '@/types';

interface VideoPlayerModalProps {
  video: VideoGenerationResult;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPlayerModal({ video, isOpen, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [playPromise, setPlayPromise] = useState<Promise<void> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(true);
      setHasError(false);
      setPlayPromise(null);
    } else {
      setPlayPromise(null);
    }
  }, [isOpen]);

  // Set up video event listeners when modal is open and video is available
  useEffect(() => {
    if (!isOpen) return;
    
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };
    
    const handleDurationChange = () => {
      if (videoElement.duration && !isNaN(videoElement.duration) && isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleLoadedData = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };

    const handleError = (e: any) => {
      console.error('Video loading error:', e, videoElement.error);
      setIsLoading(false);
      setHasError(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleLoadedMetadata = () => {
      if (videoElement.duration && !isNaN(videoElement.duration) && isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handleSeeking = () => {
      setIsLoading(true);
    };

    const handleSeeked = () => {
      setIsLoading(false);
    };

    // Add all event listeners
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);

    // Set up a timeout to force loading to false after 10 seconds
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    return () => {
      clearTimeout(loadingTimeout);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('seeking', handleSeeking);
      videoElement.removeEventListener('seeked', handleSeeked);
    };
  }, [isOpen, video.id]); // video.videoUrl 대신 video.id를 사용하여 불필요한 재등록 방지

  // Check video readiness and force loading state to false if video is ready
  useEffect(() => {
    if (!isOpen || !isLoading) return;

    const checkVideoReadiness = () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // If video is ready to play but still loading, force loading to false
      if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        setIsLoading(false);
        
        // Also set duration if available
        if (videoElement.duration && !isNaN(videoElement.duration) && isFinite(videoElement.duration)) {
          setDuration(videoElement.duration);
        }
      }
    };

    // Check immediately
    checkVideoReadiness();

    // Check again after a short delay
    const timeoutId = setTimeout(checkVideoReadiness, 1000);

    return () => clearTimeout(timeoutId);
  }, [isOpen, isLoading]);

  // Force duration check when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const forceDurationCheck = () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      if (videoElement.duration && !isNaN(videoElement.duration) && isFinite(videoElement.duration) && !duration) {
        setDuration(videoElement.duration);
      }
    };

    // Check after short delays to ensure video is fully loaded
    const timeouts = [500, 1000, 2000].map(delay => 
      setTimeout(forceDurationCheck, delay)
    );

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isOpen, duration]);

  // Cleanup play promise on unmount
  useEffect(() => {
    return () => {
      setPlayPromise(null);
    };
  }, []);

  const togglePlay = async () => {
    const videoElement = videoRef.current;
    if (!videoElement || isLoading || hasError) return;

    try {
      if (isPlaying || !videoElement.paused) {
        // If there's a play promise, wait for it to complete before pausing
        if (playPromise) {
          await playPromise;
        }
        videoElement.pause();
        setIsPlaying(false);
      } else {
        const promise = videoElement.play();
        setPlayPromise(promise);
        if (promise) {
          await promise;
          setIsPlaying(true);
          setPlayPromise(null);
        }
      }
    } catch (err) {
      console.error('Error toggling play:', err);
      setIsPlaying(false); // Assume it failed to play
      setPlayPromise(null);
    }
  };

  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.muted = !videoElement.muted;
    setIsMuted(videoElement.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = parseFloat(e.target.value);
    videoElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (!isFullscreen) {
      videoElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    if (video.videoUrl) {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <div className="relative bg-black">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full aspect-video"
            poster={video.thumbnailUrl}
            onClick={togglePlay}
            preload="auto"
            controls={false}
            playsInline
            autoPlay
            muted={isMuted}
            key={video.videoUrl} // Force re-render when video URL changes
            onLoadStart={() => {
              setIsLoading(true);
              setPlayPromise(null);
            }}
            onLoadedMetadata={(e) => {
              if (e.currentTarget.duration && !isNaN(e.currentTarget.duration) && isFinite(e.currentTarget.duration)) {
                setDuration(e.currentTarget.duration);
              }
              setIsLoading(false);
            }}
            onCanPlay={(e) => {
              if (e.currentTarget.duration && !isNaN(e.currentTarget.duration) && isFinite(e.currentTarget.duration)) {
                setDuration(e.currentTarget.duration);
              }
              setIsLoading(false);
            }}
            onPlay={() => {
              setIsPlaying(true);
            }}
            onPause={() => {
              setIsPlaying(false);
            }}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onDurationChange={(e) => {
              if (e.currentTarget.duration && !isNaN(e.currentTarget.duration) && isFinite(e.currentTarget.duration)) {
                setDuration(e.currentTarget.duration);
              }
            }}
            onError={(e) => {
              console.error('Video onError:', e);
              setIsLoading(false);
              setHasError(true);
            }}
          >
            {video.videoUrl && (
              <source src={video.videoUrl} type="video/mp4" />
            )}
            브라우저에서 비디오를 지원하지 않습니다.
          </video>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>비디오를 로딩중...</p>
                <p className="text-sm mt-2 opacity-75">
                  {video.videoUrl ? `파일: ${video.videoUrl.split('/').pop()}` : '파일 경로 없음'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoading(false);
                  }}
                  className="mt-4 text-black"
                >
                  로딩 건너뛰기
                </Button>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <p className="mb-4">비디오를 로드할 수 없습니다.</p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setHasError(false);
                    setIsLoading(true);
                    setPlayPromise(null);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="text-black"
                >
                  다시 시도
                </Button>
              </div>
            </div>
          )}

          {/* Custom controls overlay */}
          {!isLoading && !hasError && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              {/* Progress bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                  title={`Progress: ${currentTime.toFixed(1)}s / ${duration ? duration.toFixed(1) : '?'}s`}
                />
                {/* Debug info - remove this after fixing the issue */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-white/60 mt-1">
                    Duration: {duration || 'not set'} | Current: {currentTime.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20"
                    title={`${isPlaying ? 'Pause' : 'Play'} (isPlaying: ${isPlaying})`}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>

                  <div className="text-sm">
                    {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '0:00'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className="text-white hover:bg-white/20"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20"
                    title="Fullscreen"
                  >
                    <Maximize className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video information */}
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {video.koreanPrompt}
            </DialogTitle>
            <DialogDescription>
              번역: {video.englishPrompt}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            {video.duration && (
              <span>길이: {video.duration}초</span>
            )}
                          {video.resolution && video.resolution.match(/^\d+x\d+$/) && (
                <span>해상도: {video.resolution}</span>
              )}
            <span>
              생성일: {video.createdAt.toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 