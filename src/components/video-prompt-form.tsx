'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Loader2, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { 
  DEFAULT_TRANSLATION_MODELS, 
  DEFAULT_VIDEO_GENERATION_MODELS, 
  DEFAULT_AI_MODEL_CONFIG,
  AIModelConfig 
} from '@/types';

interface VideoPromptFormProps {
  onSubmit: (prompt: string, config: AIModelConfig, userEmail: string) => void;
  isLoading: boolean;
}

export function VideoPromptForm({ onSubmit, isLoading }: VideoPromptFormProps) {
  const [prompt, setPrompt] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [config, setConfig] = useState<AIModelConfig>(DEFAULT_AI_MODEL_CONFIG);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && userEmail.trim() && !isLoading) {
      onSubmit(prompt.trim(), config, userEmail.trim());
      setPrompt('');
      setUserEmail('');
    }
  };

  const updateTranslationModel = (model: string) => {
    setConfig(prev => ({ ...prev, translationModel: model }));
  };

  const updateVideoGenerationModel = (model: string) => {
    setConfig(prev => ({ ...prev, videoGenerationModel: model }));
  };

  const updateSystemInstruction = (instruction: string) => {
    setConfig(prev => ({
      ...prev,
      translationPromptConfig: {
        ...prev.translationPromptConfig,
        systemInstruction: instruction
      }
    }));
  };

  const updateUserPromptTemplate = (template: string) => {
    setConfig(prev => ({
      ...prev,
      translationPromptConfig: {
        ...prev.translationPromptConfig,
        userPromptTemplate: template
      }
    }));
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          한국어 비디오 프롬프트
        </CardTitle>
        <CardDescription>
          한국어로 비디오 생성 프롬프트를 입력하세요. 선택한 번역 모델이 영어로 번역하고 비디오 생성 모델이 비디오를 생성합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Email Input */}
          <div className="space-y-2">
            <Label htmlFor="user-email">사용자 이메일</Label>
            <Input
              id="user-email"
              type="email"
              value={userEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserEmail(e.target.value)}
              placeholder="example@email.com"
              required
              disabled={isLoading}
            />
          </div>

          {/* Main Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">비디오 프롬프트</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 여우가 숲에서 뛰어다니고 있습니다."
              className="min-h-[120px] resize-none"
              disabled={isLoading}
              suppressHydrationWarning
            />
          </div>

          {/* Model Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="translation-model">번역 모델</Label>
              <Select 
                value={config.translationModel} 
                onValueChange={updateTranslationModel}
                disabled={isLoading}
              >
                <SelectTrigger id="translation-model">
                  <SelectValue placeholder="번역 모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_TRANSLATION_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        {model.description && (
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-model">비디오 생성 모델</Label>
              <Select 
                value={config.videoGenerationModel} 
                onValueChange={updateVideoGenerationModel}
                disabled={isLoading}
              >
                <SelectTrigger id="video-model">
                  <SelectValue placeholder="비디오 생성 모델 선택" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_VIDEO_GENERATION_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        {model.description && (
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Settings - Collapsible */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                type="button" 
                className="w-full justify-between"
                disabled={isLoading}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  고급 번역 설정
                </span>
                {isAdvancedOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="system-instruction">시스템 지시사항</Label>
                  <Textarea
                    id="system-instruction"
                    value={config.translationPromptConfig.systemInstruction}
                    onChange={(e) => updateSystemInstruction(e.target.value)}
                    placeholder="번역 AI에게 주는 시스템 지시사항을 입력하세요"
                    className="min-h-[80px] resize-none"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    번역 AI의 역할과 번역 방식을 정의합니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-prompt-template">사용자 프롬프트 템플릿</Label>
                  <Textarea
                    id="user-prompt-template"
                    value={config.translationPromptConfig.userPromptTemplate}
                    onChange={(e) => updateUserPromptTemplate(e.target.value)}
                    placeholder="번역할 텍스트를 포함한 프롬프트 템플릿"
                    className="min-h-[60px] resize-none"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {'{text}'}를 사용하여 번역할 텍스트가 삽입될 위치를 지정하세요.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfig({ ...config, translationPromptConfig: DEFAULT_AI_MODEL_CONFIG.translationPromptConfig })}
                  disabled={isLoading}
                >
                  기본값으로 복원
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!prompt.trim() || !userEmail.trim() || isLoading}
            className="w-full"
            size="lg"
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

        {/* Current Configuration Display */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">현재 설정:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">번역 모델:</span>{' '}
              {DEFAULT_TRANSLATION_MODELS.find(m => m.id === config.translationModel)?.name}
            </div>
            <div>
              <span className="font-medium">비디오 모델:</span>{' '}
              {DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel)?.name}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 