'use client';

import { useVideoGeneration } from '@/hooks/use-video-generation';
import { VideoPromptForm } from './video-prompt-form';
import { VideoResultCard } from './video-result-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Video } from 'lucide-react';
import { useState, useEffect } from 'react';

export function VideoDashboard() {
  const { results, isLoading, error, generateVideo, clearResults } = useVideoGeneration();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Video className="h-8 w-8 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900">
                Veo 비디오 생성 대시보드
              </h1>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              한국어 프롬프트를 입력하면 Gemini가 영어로 번역하고 Veo가 멋진 비디오를 생성합니다.
            </p>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Video className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Veo 비디오 생성 대시보드
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            한국어 프롬프트를 입력하면 Gemini가 영어로 번역하고 Veo가 멋진 비디오를 생성합니다.
          </p>
        </div>

        {/* Form Section */}
        <div className="flex justify-center">
          <VideoPromptForm onSubmit={generateVideo} isLoading={isLoading} />
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                생성 결과 ({results.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearResults}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                모두 삭제
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {results
                .slice()
                .reverse() // Show newest first
                .map((result) => (
                  <VideoResultCard key={result.id} result={result} />
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && (
          <div className="text-center py-12">
            <Video className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              아직 생성된 비디오가 없습니다
            </h3>
            <p className="text-gray-600">
              위의 폼에서 한국어 프롬프트를 입력하여 첫 번째 비디오를 생성해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 