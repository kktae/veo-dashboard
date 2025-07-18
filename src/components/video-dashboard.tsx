'use client';

import { useVideoGeneration } from '@/hooks/use-video-generation';
import { VideoPromptForm } from './video-prompt-form';
import { VideoResultCard } from './video-result-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Trash2, Video, Check, X, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Logger } from '@/lib/logger';

export function VideoDashboard() {
  const { 
    results, 
    isLoading, 
    isAppending,
    error, 
    selectedIds,
    isInitialLoading,
    totalCount,
    currentPage,
    totalPages,
    hasMore,
    changePage,
    generateVideo, 
    clearResults,
    toggleVideoSelection,
    selectAllVideos,
    deselectAllVideos,
    deleteSelectedVideos
  } = useVideoGeneration();
  const [isMounted, setIsMounted] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const selectAllCheckboxRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Set indeterminate state for select-all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const someSelected = selectedIds.length > 0 && selectedIds.length < results.length;
      // Find the actual input element within the checkbox component
      const inputElement = selectAllCheckboxRef.current.querySelector('input');
      if (inputElement) {
        inputElement.indeterminate = someSelected;
      }
    }
  }, [selectedIds.length, results.length]);


  const handleDeleteSelected = async () => {
    if (!deleteKey) {
      toast.error('삭제 키를 입력해주세요.');
      return;
    }
    setIsDeleting(true);
    const toastId = toast.loading('선택한 비디오를 삭제 중입니다...');
    try {
      await deleteSelectedVideos(deleteKey);
      toast.success('선택한 비디오를 성공적으로 삭제했습니다.', { id: toastId });
      setIsDeleteDialogOpen(false);
      setDeleteKey('');
      // Refresh current page data
      changePage(currentPage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      toast.error('삭제에 실패했습니다.', {
        id: toastId,
        description: errorMessage,
      });
      Logger.warn('Client - handleDeleteSelected failed', { error: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!deleteKey) {
      toast.error('삭제 키를 입력해주세요.');
      return;
    }
    setIsDeleting(true);
    const toastId = toast.loading('모든 비디오를 삭제 중입니다...');
    try {
      await clearResults(deleteKey);
      toast.success('모든 비디오를 성공적으로 삭제했습니다.', { id: toastId });
      setIsClearAllDialogOpen(false);
      setDeleteKey('');
      // Go back to first page after clearing all
      changePage(1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      toast.error('삭제에 실패했습니다.', {
        id: toastId,
        description: errorMessage,
      });
      Logger.warn('Client - handleClearAll failed', { error: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white p-4">
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
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border p-8">
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

  const allSelected = results.length > 0 && selectedIds.length === results.length;


  return (
    <div className="min-h-screen bg-white p-4">
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

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                생성 결과 (총 {totalCount}개)
              </h2>
              
              <div className="flex items-center gap-3">
                {/* Selection Controls */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      ref={selectAllCheckboxRef}
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllVideos();
                        } else {
                          deselectAllVideos();
                        }
                      }}
                    />
                    <span className="text-sm text-gray-600">
                      {selectedIds.length > 0 
                        ? `${selectedIds.length} / ${results.length}개 선택됨`
                        : '전체 선택'
                      }
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedIds.length > 0 && (
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택 삭제 ({selectedIds.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>선택한 비디오를 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          선택된 {selectedIds.length}개의 비디오가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 삭제하려면 관리자 키를 입력하세요.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Input 
                          type="password"
                          placeholder="삭제 키 입력"
                          value={deleteKey}
                          onChange={(e) => setDeleteKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleDeleteSelected();
                            }
                          }}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteKey('')}>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSelected}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      모두 삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>모든 비디오를 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        총 {totalCount}개의 모든 비디오가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 삭제하려면 관리자 키를 입력하세요.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Input 
                        type="password"
                        placeholder="삭제 키 입력"
                        value={deleteKey}
                        onChange={(e) => setDeleteKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleClearAll();
                          }
                        }}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteKey('')}>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        모두 삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {results.map((result) => (
                <VideoResultCard 
                  key={result.id} 
                  result={result}
                  isSelected={selectedIds.includes(result.id)}
                  onToggleSelection={toggleVideoSelection}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) changePage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const startPage = Math.max(1, currentPage - 2);
                      const pageNumber = startPage + i;
                      
                      if (pageNumber > totalPages) return null;
                      
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              changePage(pageNumber);
                            }}
                            isActive={currentPage === pageNumber}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) changePage(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}

        {/* Initial Loading State */}
        {isInitialLoading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isInitialLoading && results.length === 0 && (
          <div className="text-center py-12">
            <Video className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              아직 생성된 비디오가 없습니다
            </h3>
            <p className="text-gray-600 mb-6">
              위의 폼에서 한국어 프롬프트를 입력하여 첫 번째 비디오를 생성해보세요.
            </p>
            <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Video className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    시작하는 방법
                  </h4>
                  <p className="text-sm text-blue-700">
                    한국어로 원하는 비디오 내용을 설명하면, AI가 자동으로 영어로 번역하고 고품질 비디오를 생성합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 