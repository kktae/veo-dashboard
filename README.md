# Veo 비디오 생성 대시보드

한국어 프롬프트를 입력하여 비디오를 생성하고 관리하는 웹 대시보드입니다.

## 시스템 아키텍처

```mermaid
graph TD
    subgraph "사용자"
        A["브라우저"]
    end

    subgraph "애플리케이션 (Next.js on Docker)"
        B["웹 UI (React)"]
        C["API 라우트"]
    end

    subgraph "백엔드 서비스"
        D["PostgreSQL (Docker)"]
        E["Google Vertex AI (Veo & Gemini)"]
    end

    A -- "HTTP 요청" --> B
    B -- "API 호출 (영상 생성/조회)" --> C
    C -- "번역/영상 생성 요청" --> E
    C -- "메타데이터 저장/조회" --> D
    E -- "생성된 영상/데이터 반환" --> C
```

## 주요 기능

- **AI 기반 비디오 생성**: 한국어 프롬프트를 입력하면 영어로 자동 번역 후 Google Veo 모델을 통해 비디오를 생성합니다.
- **실시간 상태 추적**: 비디오 생성 과정을 대기, 번역, 생성, 완료 단계로 나누어 실시간으로 추적합니다.
- **백그라운드 처리**: 브라우저를 새로고침하거나 닫아도 서버에서 비디오 생성 작업이 중단되지 않습니다.
- **비디오 관리**: 생성된 비디오 목록을 썸네일과 함께 확인하고, 개별 비디오를 재생하거나 삭제할 수 있습니다.
- **데이터 영속성**: 비디오 메타데이터는 Docker 볼륨을 통해 PostgreSQL 데이터베이스에 영구적으로 저장됩니다.
- **자동 백업**: 매일 데이터베이스를 자동으로 백업하고, 최근 7일 치의 백업을 유지합니다.

## 기술 스택

- **Frontend**: Next.js (App Router), React, TypeScript
- **UI**: shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes
- **Runtime**: Bun
- **Database**: PostgreSQL
- **AI Services**: Google Vertex AI (Veo for Video, Gemini for Translation)
- **Containerization**: Docker, Docker Compose

## 시작하기

### 요구사항

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) 및 Docker Compose

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd veo-dashboard-poc
bun install
```

### 2. 환경 변수 설정

루트 디렉토리에 `.env.local` 파일을 생성하고 아래 내용을 환경에 맞게 수정합니다.

```env
# PostgreSQL Database (필수)
# compose.yaml의 설정과 일치시켜야 합니다.
POSTGRES_USER=veo_user
POSTGRES_PASSWORD=veo_password
DATABASE_URL=postgresql://veo_user:veo_password@localhost:5432/veo_dashboard

# Google Cloud (필수)
# https://cloud.google.com/vertex-ai/docs/generative-ai/multimodal/setup
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1 # Veo 모델을 지원하는 리전

# Google Cloud 인증 정보
# 서비스 계정 키를 다운로드하여 아래 경로에 저장해야 합니다.
# ./credentials/application_default_credentials.json
```

**참고**: Google Cloud 서비스 계정 키는 `Vertex AI User` 역할이 필요합니다.

### 3. Docker로 서비스 실행

모든 서비스를 Docker Compose로 한번에 실행합니다.

```bash
docker compose up -d --build
```

- **웹 대시보드**: [http://localhost:3000](http://localhost:3000)
- **PostgreSQL Port**: `5432`

생성된 비디오와 썸네일은 로컬의 `public/videos` 및 `public/thumbnails` 디렉토리에 저장되어 직접 확인할 수 있습니다.

### 4. 로컬 개발 서버 실행 (Docker 미사용 시)

Docker를 사용하지 않고 프론트엔드만 별도로 실행할 경우, PostgreSQL 데이터베이스를 직접 실행해야 합니다.

```bash
# PostgreSQL 컨테이너만 실행
docker compose up -d postgres

# 개발 서버 실행
bun run dev
```

## 프로젝트 구조

```
veo-dashboard-poc/
├── compose.yaml              # Docker 서비스 정의
├── Dockerfile                # 애플리케이션 Docker 이미지 설정
├── public/                   # 정적 에셋 (생성된 비디오/썸네일 포함)
│   ├── videos/
│   └── thumbnails/
├── src/
│   ├── app/
│   │   ├── api/              # 백엔드 API 라우트
│   │   ├── page.tsx          # 메인 페이지
│   │   └── layout.tsx        # 공통 레이아웃
│   ├── components/           # React 컴포넌트
│   ├── lib/                  # 핵심 로직 (AI, DB, Utils)
│   └── hooks/                # React 훅
└── credentials/
    └── application_default_credentials.json # Google Cloud 인증 키 (Git 추적 안됨)
```
