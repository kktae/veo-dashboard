'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Send, Loader2, ChevronDown, ChevronRight, Settings, Clock, Lock, Volume2, VolumeX, Sparkles, X, Maximize } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
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
  const [videoGenerationEnabled, setVideoGenerationEnabled] = useState<boolean | null>(null);

  // 컴포넌트 마운트 시 비디오 생성 기능 상태 확인
  useEffect(() => {
    checkVideoGenerationStatus();
  }, []);

  const checkVideoGenerationStatus = async () => {
    try {
      const response = await fetch('/api/admin/toggle-feature', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setVideoGenerationEnabled(data.videoGenerationEnabled);
      }
    } catch (error) {
      console.error('Failed to check video generation status:', error);
      setVideoGenerationEnabled(true); // 에러 시 기본적으로 활성화
    }
  };

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
    // 선택된 모델의 capabilities 찾기
    const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === model);
    const capabilities = selectedModel?.capabilities;
    
    setConfig(prev => {
      let newConfig = {
        ...prev,
        videoGenerationModel: model
      };

      // Duration 설정 조정
      if (capabilities?.durationRange.fixed) {
        // 고정값이 있는 경우 (Veo 3.0)
        newConfig.durationSeconds = capabilities.durationRange.fixed;
      } else if (capabilities?.durationRange) {
        // 현재 duration이 새로운 범위를 벗어나는 경우 조정
        const { min, max } = capabilities.durationRange;
        if (prev.durationSeconds < min || prev.durationSeconds > max) {
          newConfig.durationSeconds = max; // 기본값을 최대값으로 설정
        }
      }

      // 오디오 생성 기능 지원하지 않는 모델의 경우 비활성화
      if (!capabilities?.supportsAudioGeneration && prev.generateAudio) {
        newConfig.generateAudio = false;
      }

      return newConfig;
    });
  };

  const updateDuration = (duration: number[]) => {
    setConfig(prev => ({ ...prev, durationSeconds: duration[0] }));
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

  const updateEnhancePrompt = (enabled: boolean) => {
    setConfig(prev => ({ ...prev, enhancePrompt: enabled }));
  };

  const updateGenerateAudio = (enabled: boolean) => {
    setConfig(prev => ({ ...prev, generateAudio: enabled }));
  };

  const updateNegativePrompt = (prompt: string) => {
    setConfig(prev => ({ ...prev, negativePrompt: prompt }));
  };

  const updateAspectRatio = (ratio: string) => {
    setConfig(prev => ({ ...prev, aspectRatio: ratio }));
  };

  return (
    <Card className="w-full max-w-4xl transition-all duration-200 hover:shadow-lg hover:border-blue-500 hover:-translate-y-1">
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
        {/* Video Generation Status Alert */}
        {videoGenerationEnabled === false && (
          <Alert className="border-red-200 bg-red-50">
            <Lock className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>비디오 생성 기능이 일시적으로 비활성화되어 있습니다.</strong><br />
              관리자에 의해 기능이 비활성화되었습니다. 관리자에게 문의하시거나 잠시 후 다시 시도해주세요.
            </AlertDescription>
          </Alert>
        )}

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
            <Label htmlFor="prompt">프롬프트 (한국어)</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="생성하고 싶은 비디오에 대해 자세히 설명해주세요..."
              className="min-h-[100px] resize-none"
              disabled={isLoading}
            />
            {(() => {
              const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
              return (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 상세한 설명일수록 더 정확한 결과를 얻을 수 있습니다.</p>
                  {selectedModel?.capabilities.promptRewriter.enhancesPromptsUnder30Words && (
                    <p>• 30단어 미만의 간단한 프롬프트는 AI가 자동으로 개선하여 응답에 포함됩니다.</p>
                  )}
                  {selectedModel?.capabilities.supportsAudioGeneration && (
                    <p>• {selectedModel.name}에서는 오디오가 포함된 비디오를 생성할 수 있습니다.</p>
                  )}
                  {!selectedModel?.capabilities.promptRewriter.canDisable && (
                    <p className="text-amber-600">• {selectedModel?.name}에서는 프롬프트 재작성기가 항상 활성화됩니다.</p>
                  )}
                </div>
              );
            })()}
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

          {/* Video Generation Options */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-blue-800">비디오 생성 옵션</Label>
            </div>

            {/* Duration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="duration" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  비디오 길이 (초)
                </Label>
                <span className="text-sm font-medium text-muted-foreground bg-white px-2 py-1 rounded-md border">
                  {config.durationSeconds}초
                </span>
              </div>
              {(() => {
                const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
                const capabilities = selectedModel?.capabilities;
                const isFixed = capabilities?.durationRange.fixed !== undefined;
                const min = capabilities?.durationRange.min || 5;
                const max = capabilities?.durationRange.max || 8;
                
                return (
                  <>
                    <Slider
                      id="duration"
                      min={min}
                      max={max}
                      step={1}
                      value={[config.durationSeconds]}
                      onValueChange={updateDuration}
                      disabled={isLoading || isFixed}
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isFixed 
                        ? `${selectedModel?.name}은 ${capabilities?.durationRange.fixed}초 고정입니다.`
                        : `${selectedModel?.name}은 ${min}-${max}초 설정 가능합니다. 길수록 더 많은 처리 시간이 필요합니다.`
                      }
                    </p>
                  </>
                );
              })()}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Enhance Prompt Toggle */}
              {(() => {
                const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
                const promptRewriterSupported = selectedModel?.capabilities.promptRewriter.supported;
                const canDisablePromptRewriter = selectedModel?.capabilities.promptRewriter.canDisable;
                
                if (!promptRewriterSupported) return null;
                
                return (
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-2">
                      {config.enhancePrompt ? (
                        <Sparkles className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-gray-400" />
                      )}
                      <div className="flex flex-col">
                        <Label htmlFor="enhance-prompt" className="text-sm font-medium">
                          프롬프트 개선 {!canDisablePromptRewriter && '(필수)'}
                        </Label>
                        {!canDisablePromptRewriter && (
                          <span className="text-xs text-amber-600">
                            {selectedModel?.name}에서는 프롬프트 재작성기를 비활성화할 수 없습니다
                          </span>
                        )}
                        {selectedModel?.capabilities.promptRewriter.enhancesPromptsUnder30Words && (
                          <span className="text-xs text-gray-500">
                            30단어 미만 프롬프트에서 재작성된 프롬프트가 응답에 포함됩니다
                          </span>
                        )}
                      </div>
                    </div>
                    <Switch
                      id="enhance-prompt"
                      checked={config.enhancePrompt}
                      onCheckedChange={updateEnhancePrompt}
                      disabled={isLoading || !canDisablePromptRewriter}
                    />
                  </div>
                );
              })()}

              {/* Aspect Ratio Selector */}
              {(() => {
                const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
                const supportedRatios = selectedModel?.capabilities.aspectRatios || ['16:9'];
                
                return (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Maximize className="h-4 w-4" />
                      화면비
                    </Label>
                    <Select
                      value={config.aspectRatio}
                      onValueChange={updateAspectRatio}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedRatios.map((ratio) => (
                          <SelectItem key={ratio} value={ratio}>
                            {ratio === '16:9' ? '16:9 (가로형)' : '9:16 (세로형)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!supportedRatios.includes('9:16') && (
                      <p className="text-xs text-amber-600">
                        {selectedModel?.name}에서는 9:16 세로형 화면비를 지원하지 않습니다
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Generate Audio Toggle */}
              {(() => {
                const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
                const capabilities = selectedModel?.capabilities;
                const supportsAudio = capabilities?.supportsAudioGeneration || false;
                
                return (
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-2">
                      {config.generateAudio && supportsAudio ? (
                        <Volume2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <VolumeX className="h-4 w-4 text-gray-400" />
                      )}
                      <Label htmlFor="generate-audio" className="text-sm font-medium">
                        오디오 생성
                        {!supportsAudio && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({selectedModel?.name} 미지원)
                          </span>
                        )}
                      </Label>
                    </div>
                    <Switch
                      id="generate-audio"
                      checked={config.generateAudio && supportsAudio}
                      onCheckedChange={updateGenerateAudio}
                      disabled={isLoading || !supportsAudio}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="negative-prompt" className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-600" />
                  네거티브 프롬프트
                </Label>
                {config.negativePrompt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateNegativePrompt('')}
                    disabled={isLoading}
                    className="h-6 px-2 text-xs"
                  >
                    지우기
                  </Button>
                )}
              </div>
              <Textarea
                id="negative-prompt"
                value={config.negativePrompt}
                onChange={(e) => updateNegativePrompt(e.target.value)}
                placeholder="원하지 않는 요소들을 입력하세요 (예: 흐릿한, 어두운, 왜곡된)"
                className="min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                비디오에 나타나지 않았으면 하는 요소들을 설명하세요. 이는 더 정확한 결과를 얻는 데 도움이 됩니다.
              </p>
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
            disabled={!prompt.trim() || !userEmail.trim() || isLoading || videoGenerationEnabled === false}
            className="w-full"
            size="lg"
          >
            {videoGenerationEnabled === false ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                비디오 생성 기능 비활성화됨
              </>
            ) : isLoading ? (
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
            {(() => {
              const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
              const capabilities = selectedModel?.capabilities;
              
              return (
                <>
                  <p><strong>번역 모델:</strong> {config.translationModel}</p>
                  <p><strong>비디오 모델:</strong> {selectedModel?.name || config.videoGenerationModel}</p>
                  <p>
                    <strong>비디오 길이:</strong> {config.durationSeconds}초
                    {capabilities?.durationRange.fixed && (
                      <span className="text-blue-600 ml-1">(고정)</span>
                    )}
                  </p>
                  <p>
                    <strong>프롬프트 개선:</strong> 
                    {capabilities?.promptRewriter.supported ? (
                      config.enhancePrompt ? (
                        <span className="text-green-600">활성화</span>
                      ) : (
                        <span className="text-gray-600">비활성화</span>
                      )
                    ) : (
                      <span className="text-gray-400">미지원</span>
                    )}
                    {capabilities?.promptRewriter.canDisable === false && (
                      <span className="text-amber-600 ml-1">(필수)</span>
                    )}
                  </p>
                  <p>
                    <strong>오디오 생성:</strong> 
                    {capabilities?.supportsAudioGeneration ? (
                      config.generateAudio ? (
                        <span className="text-green-600">활성화</span>
                      ) : (
                        <span className="text-gray-600">비활성화</span>
                      )
                    ) : (
                      <span className="text-gray-400">미지원</span>
                    )}
                  </p>
                  <p><strong>화면비:</strong> {config.aspectRatio}</p>
                  <p><strong>네거티브 프롬프트:</strong> {config.negativePrompt ? '설정됨' : '없음'}</p>
                </>
              );
            })()}
          </div>
          
          {/* Model Capabilities Info */}
          {(() => {
            const selectedModel = DEFAULT_VIDEO_GENERATION_MODELS.find(m => m.id === config.videoGenerationModel);
            if (!selectedModel) return null;
            
            return (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs font-medium text-blue-800 mb-2">{selectedModel.name} 모델 특징:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-blue-700">
                  <p>• 비디오 길이: {selectedModel.capabilities.durationRange.fixed ? 
                    `${selectedModel.capabilities.durationRange.fixed}초 고정` : 
                    `${selectedModel.capabilities.durationRange.min}-${selectedModel.capabilities.durationRange.max}초`}</p>
                  <p>• 오디오 생성: {selectedModel.capabilities.supportsAudioGeneration ? '지원' : '미지원'}</p>
                  <p>• 비디오 확장: {selectedModel.capabilities.supportsVideoExtension ? '지원' : '미지원'}</p>
                  <p>• 화면비: {selectedModel.capabilities.aspectRatios.join(', ')}</p>
                  <p>• 프롬프트 재작성기: {selectedModel.capabilities.promptRewriter.canDisable ? '선택적' : '필수'}</p>
                  {selectedModel.capabilities.promptRewriter.enhancesPromptsUnder30Words && (
                    <p className="md:col-span-2">• 30단어 미만 프롬프트 자동 개선 및 응답 포함</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
} 