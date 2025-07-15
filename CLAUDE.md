# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun install` - Install dependencies
- `bun run dev` - Start development server with Turbopack (faster)
- `bun run dev:prod` - Start development server without Turbopack
- `bun run build` - Build for production
- `bun run start` - Start production server (runs on 0.0.0.0:3000)
- `bun run lint` - Run ESLint

### Production Deployment
- `docker compose up -d --build` - Build and run all services (recommended)
- `docker compose up -d postgres` - Run only PostgreSQL for local development

### Server Management with tmux
- `tmux new-session -d -s webserver 'bun run start'` - Start server in background
- `tmux attach -t webserver` - Attach to running server session
- `tmux kill-session -t webserver` - Stop the server

## Architecture

This is a Next.js application for AI video generation using Google's Veo AI model. The system consists of:

### Core Services
- **Frontend**: Next.js (App Router) with React and TypeScript
- **Backend**: Next.js API Routes 
- **Database**: PostgreSQL (containerized)
- **AI Services**: Google Vertex AI (Veo for video generation, Gemini for translation)
- **Runtime**: Bun (JavaScript runtime)

### Key Libraries
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **Database Client**: pg (PostgreSQL client)
- **AI SDK**: @google/genai for Vertex AI integration
- **Form Handling**: react-hook-form with zod validation

### File Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (UI and application-specific)
- `src/lib/` - Core business logic and utilities
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions

### Database Schema
The application uses PostgreSQL with two main tables:
- `videos` - Stores video generation metadata and status
- `admin_settings` - Stores application configuration

### Video Generation Flow
1. User submits Korean prompt via `video-prompt-form.tsx`
2. Korean text translated to English using Gemini (via `ai.ts:TranslationService`)
3. English prompt sent to Veo model for video generation
4. Background processing monitors generation status
5. Completed videos stored in `public/videos/` with thumbnails in `public/thumbnails/`

## Environment Configuration

Required environment variables in `.env.local`:
```bash
# PostgreSQL Database
POSTGRES_USER=veo_user
POSTGRES_PASSWORD=veo_password
DATABASE_URL=postgresql://veo_user:veo_password@localhost:5432/veo_dashboard

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

Google Cloud service account credentials must be placed at:
`./credentials/application_default_credentials.json`

## Important Implementation Details

### Model Capabilities
The system supports multiple Veo models with different capabilities defined in `ai.ts:VideoGenerationService`. Each model has specific parameter validation for duration, audio generation, aspect ratios, etc.

### Error Handling & Retry Logic
- All API calls use retry logic with exponential backoff (see `api-utils.ts`)
- Video generation operations use intelligent polling with rate limit handling
- Comprehensive logging throughout the system via `logger.ts`

### Database Management
- Singleton pattern for database connections in `database.ts`
- Automatic schema creation and migration on startup
- Admin settings system for feature toggles

### State Management
Video generation state is managed through custom hooks:
- `use-video-generation.ts` - Handles video creation workflow
- `use-video-sync.ts` - Manages background synchronization

### API Architecture
REST API endpoints in `src/app/api/`:
- `/api/generate-video` - Start video generation
- `/api/process-video` - Background processing endpoint
- `/api/videos` - CRUD operations for videos
- `/api/translate` - Translation service endpoint

## Docker Configuration

The application is containerized with:
- Main app container (Bun + Next.js)
- PostgreSQL container with persistent volume
- Docker Compose for orchestration

Generated videos and thumbnails are stored in Docker volumes mapped to `public/videos/` and `public/thumbnails/`.