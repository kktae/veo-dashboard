# Veo 비디오 생성 대시보드

한국어 프롬프트를 입력하여 AI가 자동으로 영어로 번역하고 비디오를 생성하는 웹 대시보드입니다.

## 🚀 주요 기능

- **한국어 프롬프트 입력**: 자연스러운 한국어로 비디오 생성 요청
- **자동 번역**: Google Gemini를 사용하여 한국어를 영어로 정확히 번역
- **AI 비디오 생성**: Google Veo 2.0을 사용하여 고품질 비디오 자동 생성 (8초, 16:9 비율)
- **실시간 상태 추적**: 번역 → 생성 → 완료 단계별 진행 상황 표시
- **PostgreSQL 데이터베이스**: 컨테이너 기반 PostgreSQL을 사용한 비디오 메타데이터 영구 저장
- **비디오 관리**: 썸네일 미리보기, 일괄 선택/삭제, 모달 플레이어

## 🚀 새로고침 방지 기능

이 애플리케이션은 브라우저 새로고침 시에도 영상 생성 작업이 중단되지 않도록 설계되었습니다.

### 주요 특징

- **백그라운드 처리**: 영상 생성은 서버에서 백그라운드로 실행되어 브라우저 새로고침과 무관하게 계속됩니다
- **상태 폴링**: 클라이언트에서 3초마다 진행 상태를 확인하여 실시간 업데이트를 제공합니다
- **자동 재시도**: 실패한 작업은 최대 3회까지 자동으로 재시도됩니다
- **진행률 표시**: 각 단계별 진행률을 시각적으로 표시합니다

### 작업 단계

1. **대기 중** (10%): 작업이 큐에 추가됨
2. **번역 중** (25%): 한국어 프롬프트를 영어로 번역
3. **영상 생성 중** (50%): AI가 영상을 생성
4. **후처리 중** (75%): 영상 다운로드 및 썸네일 생성
5. **완료** (100%): 모든 작업 완료

### 사용법

1. 프롬프트를 입력하고 영상 생성을 시작합니다
2. 새로고침을 해도 진행 상태가 유지됩니다
3. 작업이 완료되면 자동으로 결과가 표시됩니다
4. 실패한 작업은 자동으로 재시도됩니다

## 🛠 기술 스택

- **Frontend**: Next.js 15.3.3 (App Router) + React 19
- **UI Framework**: shadcn/ui + Tailwind CSS 4.0 + Radix UI
- **Runtime**: Bun (패키지 매니저 및 런타임)
- **Database**: PostgreSQL 16 (Docker 컨테이너)
- **AI Services**: 
  - Google Gemini 2.0 Flash (번역)
  - Google Veo 2.0 (비디오 생성)
- **Storage**: Google Cloud Storage (선택사항)
- **Deployment**: Docker(podman) + Docker Compose(podman-compose)

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── generate-video/route.ts    # 비디오 생성 API
│   │   ├── translate/route.ts         # 번역 API
│   │   ├── videos/[id]/route.ts       # 개별 비디오 조회 API
│   │   ├── videos/route.ts            # 비디오 목록 API
│   │   └── videos/stats/route.ts      # 비디오 통계 API
│   ├── layout.tsx                     # 글로벌 레이아웃
│   └── page.tsx                       # 메인 페이지
├── components/
│   ├── ui/                           # shadcn/ui 컴포넌트들
│   ├── video-dashboard.tsx           # 메인 대시보드
│   ├── video-prompt-form.tsx         # 프롬프트 입력 폼
│   ├── video-result-card.tsx         # 비디오 결과 카드
│   └── video-player-modal.tsx        # 비디오 플레이어 모달
├── hooks/
│   ├── use-mobile.ts                 # 모바일 감지 훅
│   └── use-video-generation.ts       # 비디오 생성 상태 관리
├── lib/
│   ├── ai.ts                         # AI 서비스 (Gemini, Veo)
│   ├── database.ts                   # PostgreSQL 데이터베이스 관리
│   ├── logger.ts                     # 구조화된 로거
│   ├── utils.ts                      # 공통 유틸리티
│   └── video-utils.ts                # 비디오 관련 유틸리티
└── types/
    └── index.ts                      # TypeScript 타입 정의
```

## 🔧 설치 및 설정

### 1. 의존성 설치
```bash
# Bun 설치 (https://bun.sh)
curl -fsSL https://bun.sh/install | bash

# 의존성 설치
bun install
```

### 2. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 값들을 설정하세요:

```bash
# PostgreSQL Database 설정 (필수)
POSTGRES_DB=veo_dashboard
POSTGRES_USER=veo_user
POSTGRES_PASSWORD=veo_password
DATABASE_URL=postgresql://veo_user:veo_password@localhost:5432/veo_dashboard

# Google Cloud 설정 (필수)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=true

# 비디오 출력 경로 (선택사항)
GOOGLE_CLOUD_OUTPUT_GCS_URI=gs://your-bucket-name/output

# Google Cloud 인증 (로컬 개발 시)
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
```

### 3. Google Cloud 설정
1. **Google Cloud Console에서 프로젝트 생성**
2. **필수 API 활성화**:
   - Vertex AI API
   - Generative AI API
3. **서비스 계정 생성 및 키 다운로드**
   - `credentials/service-account.json`에 저장
4. **권한 설정**: Vertex AI User, Storage Object Admin (GCS 사용 시)

### 4. PostgreSQL 데이터베이스 시작
```bash
# PostgreSQL 컨테이너 시작
chmod +x start-postgres.sh
./start-postgres.sh

# 또는 직접 시작
docker compose up -d postgres
```

### 5. 개발 서버 실행
```bash
bun run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속

## 🐳 Docker 배포

### 1. 권한 설정 (권장)
Docker 컨테이너에서 생성된 파일의 권한 문제를 방지하기 위해 다음 스크립트를 실행하세요:

```bash
# 권한 설정 스크립트 실행 (권장)
chmod +x setup-permissions.sh
./setup-permissions.sh
```

이 스크립트는 다음 작업을 자동으로 수행합니다:
- 현재 사용자의 UID/GID 감지
- `.env` 파일에 UID/GID 설정
- 필요한 디렉토리 생성 및 권한 설정
- Docker 이미지 빌드 (올바른 UID/GID 포함)

### 2. 수동 이미지 빌드 (선택사항)
```bash
# 빌드 스크립트 실행
chmod +x docker-build.sh
./docker-build.sh

# 또는 직접 빌드 (UID/GID 지정)
docker build --build-arg UID=$(id -u) --build-arg GID=$(id -g) -t localhost/veo-dashboard:latest .
```

### 3. Docker Compose로 실행
```bash
# setup-permissions.sh를 실행했다면 바로 시작 가능
docker compose up -d

# 로그 확인
docker compose logs -f veo-dashboard
```

### 4. 권한 문제 해결

만약 비디오나 썸네일 파일의 권한 문제가 발생한다면:

**문제 진단:**
```bash
# 파일 권한 확인
ls -la public/videos/
ls -la public/thumbnails/

# 컨테이너 로그 확인
docker compose logs veo-dashboard | grep -i permission
```

**해결 방법:**
```bash
# 1. 올바른 UID/GID로 이미지 재빌드
./setup-permissions.sh

# 2. 또는 기존 파일 권한 수정
sudo chown -R $(id -u):$(id -g) public/videos public/thumbnails

# 3. 컨테이너 재시작
docker compose restart veo-dashboard
```

**권한 문제 예방 모범사례:**
- ✅ 항상 `setup-permissions.sh` 스크립트 사용
- ✅ `.env` 파일에 올바른 UID/GID 설정
- ✅ Docker 이미지 빌드 시 build args 전달
- ❌ 컨테이너를 root 사용자로 실행하지 않기

### 3. 볼륨 구성 및 데이터 관리

Docker 볼륨 구성으로 PostgreSQL 데이터, 비디오, 썸네일이 영구 저장됩니다:

```yaml
volumes:
  # PostgreSQL 데이터베이스 (Named Volume)
  postgres-data: Docker 관리형 볼륨
  
  # 비디오 파일 저장소 (Host Volume)
  veo-videos: ./public/videos → /app/public/videos
  
  # 썸네일 이미지 저장소 (Host Volume)  
  veo-thumbnails: ./public/thumbnails → /app/public/thumbnails
```

**특징:**
- 🗄️ **PostgreSQL 안정성**: 별도 컨테이너로 데이터베이스 완전 격리
- 📁 **데이터 영속성**: 컨테이너 재시작/업데이트 시에도 데이터 보존
- 💾 **자동 백업**: pg_dump를 이용한 일일 자동 백업 (7일 보관)
- 🔧 **개발 편의성**: 로컬에서 비디오/썸네일 직접 확인 가능

**디렉토리 구조:**
```
project/js/veo-dashboard-poc/
├── public/
│   ├── videos/              # 생성된 비디오 파일
│   └── thumbnails/          # 비디오 썸네일
└── backups/                 # PostgreSQL 자동 백업
    └── veo-dashboard_*.sql
```

**PostgreSQL 관리:**
```bash
# 데이터베이스 연결
docker compose exec postgres psql -U veo_user -d veo_dashboard

# 백업 상태 확인
docker compose logs db-backup

# 수동 백업
docker compose exec postgres pg_dump -U veo_user veo_dashboard > backup.sql
```

## 💡 사용 방법

1. **프롬프트 입력**: 
   - 메인 페이지에서 한국어로 원하는 비디오 내용 입력
   - 예: "여우가 숲에서 뛰어다니고 있습니다"

2. **자동 처리**:
   - Gemini 2.0이 한국어를 자연스러운 영어로 번역
   - Veo 2.0이 8초 길이의 고품질 비디오 생성

3. **결과 관리**:
   - 실시간 진행 상황 표시
   - 완료된 비디오 카드 형태로 표시
   - 일괄 선택/삭제 기능
   - 모달에서 비디오 재생

## 🗄️ 데이터베이스 스키마

SQLite 데이터베이스 (`veo-meta.sqlite`):

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  korean_prompt TEXT NOT NULL,
  english_prompt TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

## 🔄 API 엔드포인트

- `POST /api/translate` - 한국어 텍스트 번역
- `POST /api/generate-video` - 비디오 생성 요청
- `GET /api/videos` - 비디오 목록 조회
- `GET /api/videos/[id]` - 개별 비디오 조회
- `GET /api/videos/stats` - 비디오 생성 통계

## 🚦 개발 가이드

### AI 모델 설정
기본 모델은 `src/types/index.ts`에서 설정:
- **번역**: `gemini-2.0-flash-lite-001`
- **비디오 생성**: `veo-2.0-generate-001`

### 커스텀 프롬프트 설정
번역 프롬프트는 API 호출 시 `promptConfig`로 커스터마이징 가능

### 로깅
구조화된 로깅 시스템 (`src/lib/logger.ts`) 사용:
```typescript
Logger.step("단계 설명", { metadata });
Logger.error("에러 메시지", { error });
```

## 📦 주요 의존성

- **@google/genai**: Google AI SDK
- **@google-cloud/storage**: Google Cloud Storage
- **lucide-react**: 아이콘
- **fluent-ffmpeg**: 비디오 처리 유틸리티
- **zod**: 스키마 검증
- **react-hook-form**: 폼 관리

## 🔒 보안 고려사항

- 서비스 계정 키는 절대 Git에 커밋하지 않음
- Docker 컨테이너에서 non-root 사용자로 실행
- 환경 변수로 민감한 정보 관리
- CORS 및 API 레이트 리미팅 권장

이 프로젝트는 Google의 최신 AI 모델을 활용하여 한국어 사용자도 쉽게 고품질 비디오를 생성할 수 있도록 설계되었습니다.
