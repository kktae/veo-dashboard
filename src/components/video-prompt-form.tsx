'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';

interface VideoPromptFormProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function VideoPromptForm({ onSubmit, isLoading }: VideoPromptFormProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>한국어 비디오 프롬프트</CardTitle>
        <CardDescription>
          한국어로 비디오 생성 프롬프트를 입력하세요. Gemini가 영어로 번역하고 Veo가 비디오를 생성합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: 여우가 숲에서 뛰어다니고 있습니다."
            className="min-h-[120px] resize-none"
            disabled={isLoading}
            suppressHydrationWarning
          />
          <Button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                비디오 생성 중...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                비디오 생성하기
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 