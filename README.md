# Veo 비디오 생성 대시보드

한국어 프롬프트를 입력하여 AI가 자동으로 영어로 번역하고 멋진 비디오를 생성하는 웹 대시보드입니다.

## 🚀 주요 기능

- **한국어 프롬프트 입력**: 자연스러운 한국어로 비디오 생성 요청
- **자동 번역**: Google Gemini를 사용하여 한국어를 영어로 정확히 번역
- **AI 비디오 생성**: Google Veo를 사용하여 고품질 비디오 자동 생성
- **실시간 상태 추적**: 번역 → 생성 → 완료 단계별 진행 상황 표시
- **아름다운 UI**: shadcn/ui 기반의 현대적이고 반응형 인터페이스

## 🛠 기술 스택

- **Frontend**: Next.js 15.3.3 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **AI 서비스**: Google Gemini (번역) + Google Veo (비디오 생성)
- **TypeScript**: 타입 안전성 보장
- **상태 관리**: React Hooks (Custom Hook 패턴)

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── translate/route.ts          # 번역 API 엔드포인트
│   │   └── generate-video/route.ts     # 비디오 생성 API 엔드포인트
│   ├── layout.tsx
│   └── page.tsx                        # 메인 페이지
├── components/
│   ├── ui/                            # shadcn/ui 컴포넌트들
│   ├── video-dashboard.tsx            # 메인 대시보드 컴포넌트
│   ├── video-prompt-form.tsx          # 프롬프트 입력 폼
│   └── video-result-card.tsx          # 결과 표시 카드
├── hooks/
│   └── use-video-generation.ts        # 비디오 생성 상태 관리 훅
├── lib/
│   ├── ai.ts                          # AI 서비스 클래스들
│   └── utils.ts                       # 유틸리티 함수들
└── types/
    └── index.ts                       # TypeScript 타입 정의
```

## 🔧 설치 및 설정

1. **의존성 설치**
   ```bash
   bun install
   ```

2. **환경 변수 설정**
   `.env.local` 파일을 생성하고 다음 값들을 설정하세요:
   ```bash
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   GOOGLE_GENAI_USE_VERTEXAI=true
   GOOGLE_CLOUD_OUTPUT_GCS_URI=gs://your-bucket-name/videos/
   ```

3. **개발 서버 실행**
   ```bash
   bun dev
   ```

4. **브라우저에서 확인**
   [http://localhost:3000](http://localhost:3000)에서 대시보드를 확인할 수 있습니다.

## 🔑 Google Cloud 설정

### 1. Google Cloud Project 설정
- Google Cloud Console에서 새 프로젝트 생성
- Vertex AI API 활성화
- Gemini API 및 Veo API 접근 권한 설정

### 2. 인증 설정
- 서비스 계정 키 생성
- `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정 또는
- Google Cloud SDK를 통한 로컬 인증

### 3. Cloud Storage 설정 (선택사항)
- 비디오 파일 저장을 위한 GCS 버킷 생성
- 적절한 권한 설정

## 💡 사용 방법

1. **프롬프트 입력**: 메인 페이지의 텍스트 영역에 한국어로 원하는 비디오 내용을 입력합니다.
   - 예: "여우가 숲에서 뛰어다니고 있습니다"
   - 예: "해변에서 파도가 치고 있는 모습"

2. **자동 처리**: 
   - Gemini가 한국어를 자연스러운 영어로 번역
   - Veo가 번역된 프롬프트로 8초 길이의 비디오 생성

3. **결과 확인**: 
   - 실시간으로 진행 상황 표시
   - 완료된 비디오는 카드 형태로 표시
   - 브라우저에서 바로 재생 가능

## 🎨 디자인 원칙

- **재사용성**: 컴포넌트와 훅을 분리하여 재사용 가능한 구조
- **유지보수성**: TypeScript와 명확한 타입 정의로 안전한 코드
- **확장성**: 새로운 AI 서비스나 기능 추가가 용이한 아키텍처
- **사용자 경험**: 직관적인 인터페이스와 실시간 피드백

## 🔄 상태 관리 패턴

```typescript
// 중앙화된 상태 관리
const { results, isLoading, error, generateVideo, clearResults } = useVideoGeneration();

// 타입 안전한 상태 업데이트
setState(prev => ({
  ...prev,
  results: prev.results.map(result =>
    result.id === id ? { ...result, status: 'generating' } : result
  ),
}));
```

## 🚦 개발 가이드

### 새로운 AI 서비스 추가
1. `src/lib/ai.ts`에 새 서비스 클래스 추가
2. `src/app/api/`에 새 API 라우트 생성
3. 필요시 타입 정의 업데이트

### 새로운 컴포넌트 추가
1. `src/components/` 디렉토리에 컴포넌트 생성
2. TypeScript 인터페이스로 Props 정의
3. shadcn/ui 컴포넌트 활용

### 상태 관리 로직 확장
1. `src/hooks/use-video-generation.ts` 훅 수정
2. 타입 정의 업데이트
3. 컴포넌트에서 새 상태 활용

이 프로젝트는 확장 가능하고 유지보수가 용이한 구조로 설계되어, 새로운 AI 서비스나 기능을 쉽게 추가할 수 있습니다.
