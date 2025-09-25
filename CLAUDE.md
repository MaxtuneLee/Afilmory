# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands

```bash
# Start development server (runs both web and SSR)
pnpm dev

# Start only web development server
pnpm --filter web dev

# Start only SSR development server
pnpm --filter @afilmory/ssr dev

# Build production version
pnpm build

# Build manifest from storage (generates photo metadata)
pnpm run build:manifest

# Force rebuild all photos and metadata
pnpm run build:manifest -- --force

# Force regenerate thumbnails only
pnpm run build:manifest -- --force-thumbnails

# Force regenerate manifest only
pnpm run build:manifest -- --force-manifest
```

### Database Commands (SSR app)

```bash
# Generate database migrations
pnpm --filter @afilmory/ssr db:generate

# Run database migrations
pnpm --filter @afilmory/ssr db:migrate
```

### Code Quality Commands

```bash
# Lint and fix code
pnpm lint

# Format code
pnpm format

# Type check (web app)
pnpm --filter web type-check
```

## Architecture

### Design Patterns & Application Structure

**Hybrid SPA + SSR Architecture**: The application uses a unique architecture where Next.js serves as both a hosting platform for the Vite-built SPA and a dynamic SEO/OG meta generator:

- **Production**: Next.js serves the pre-built SPA static assets and provides dynamic routes for SEO
- **Development**: Both servers run concurrently with the SSR app proxying to the SPA for seamless development

**Key Design Patterns**:

- **Adapter Pattern**: Builder system uses adapters for different storage providers (S3, GitHub)
- **Factory Pattern**: Photo processing pipeline with configurable workers and storage adapters
- **Observer Pattern**: Manifest changes trigger SSR meta tag updates for social sharing
- **Singleton Pattern**: PhotoLoader class provides global access to manifest data

### Monorepo Structure

This is a pnpm workspace with multiple applications and packages:

- `apps/web/` - Main frontend React application (Vite + React 19 SPA)
- `apps/ssr/` - Next.js 15 application serving as SPA host + dynamic SEO/OG generator
- `packages/builder/` - Photo processing and manifest generation tool with adapter pattern
- `packages/webgl-viewer/` - High-performance WebGL-based photo viewer component
- `packages/data/` - Shared data access layer and PhotoLoader singleton
- `packages/components/` - Reusable UI components across apps

### Next.js as SPA Host & SEO Provider

**Dual Server Architecture**:

- **Development Mode**: `apps/ssr/src/app/[...all]/route.ts` catches all SPA routes and serves index.html with injected manifest data
- **Production Mode**: Next.js serves pre-built Vite SPA assets while providing dynamic OG image generation

**Dynamic SEO Implementation**:

- `apps/ssr/src/index.html.ts` - Pre-compiled HTML template with manifest data injected as `window.__MANIFEST__`
- Dynamic OG images generated per photo via Next.js API routes (`/og/[photoId]/route.ts`)
- HTML meta tags dynamically replaced for social media sharing

### Configuration Architecture

**Two-Layer Configuration System**:

1. **Builder Config** (`builder.config.json`) - **Infrastructure/Processing Layer**:

   ```json
   {
     "storage": { "provider": "s3", "bucket": "...", "region": "..." },
     "performance": { "worker": { "workerCount": 8, "useClusterMode": true } },
     "repo": { "enable": true, "url": "...", "token": "..." }
   }
   ```
   - Controls photo processing, storage connections, and build performance
   - Handles remote git repository sync for manifest/thumbnails
   - Configures multi-process/cluster processing for large photo sets

2. **Site Config** (`site.config.ts` + `config.json`) - **Presentation/Content Layer**:
   ```typescript
   {
     name: "Gallery Name",
     description: "...",
     author: { name: "...", url: "...", avatar: "..." },
     social: { twitter: "...", github: "..." },
     map: ["maplibre"] // Map provider configuration
   }
   ```
   - Controls site branding, author info, social links
   - Merged with user `config.json` using es-toolkit/compat
   - Consumed by both SPA and SSR for consistent branding

### Manifest Generation & Data Flow

**Builder Pipeline** (`packages/builder/src/cli.ts`):

1. **Storage Sync**: Downloads photos from S3/GitHub with incremental change detection
2. **Format Processing**: HEIC→JPEG, TIFF→web formats, Live Photo detection
3. **Multi-threaded Processing**: Configurable worker pools or cluster mode for performance
4. **EXIF & Metadata Extraction**: Camera settings, GPS, Fujifilm recipes, tone analysis
5. **Thumbnail Generation**: Multiple sizes with blurhash placeholders
6. **Manifest Serialization**: Generates `photos-manifest.json` with full metadata
7. **Remote Sync**: Pushes updates to git repository if configured

**SPA Data Consumption** (`packages/data/src/index.ts`):

```typescript
class PhotoLoader {
  constructor() {
    this.photos = __MANIFEST__.data // Injected via window global
    this.cameras = __MANIFEST__.cameras
    this.lenses = __MANIFEST__.lenses
    // Creates lookup maps and provides data access layer
  }
}
```

**Data Flow**:

1. Builder generates manifest → `photos-manifest.json`
2. SSR injects manifest into HTML → `window.__MANIFEST__`
3. SPA PhotoLoader singleton consumes global data
4. React components access photos via `photoLoader.getPhotos()`

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Jotai (state), TanStack Query
- **Backend**: Next.js 15 (SPA host + SEO), Drizzle ORM, PostgreSQL
- **Image Processing**: Sharp, exiftool-vendored, HEIC conversion, blurhash generation
- **Storage**: S3-compatible (AWS/MinIO), GitHub repository storage
- **Build System**: pnpm workspaces, concurrent dev servers, cluster-based processing

### Development Workflow

- **Concurrent Development**: `pnpm dev` runs both SPA (Vite) and SSR (Next.js) servers
- **Hot Reloading**: SPA changes reflect immediately, SSR provides SEO preview
- **Manifest Building**: `pnpm run build:manifest` processes photos and updates data
- **Type Safety**: Shared types between builder, SPA, and SSR ensure consistency

### Code Quality Rules

1. Avoid code duplication - extract common types and components
2. Keep components focused - use hooks and component composition
3. Follow React best practices - proper Context usage, state management
4. Use TypeScript strictly - leverage type safety throughout

### i18n Guidelines

- Use flat keys with `.` separation (e.g., `exif.camera.model`)
- Support pluralization with `_one` and `_other` suffixes
- Modify English first, then other languages (ESLint auto-removes unused keys)
- **CRITICAL: Avoid nested key conflicts in flat structure**
  - ❌ WRONG: `"action.tag.mode.and": "AND"` + `"action.tag.mode.and.tooltip": "..."`
  - ✅ CORRECT: `"action.tag.mode.and": "AND"` + `"action.tag.tooltip.and": "..."`
  - Rule: A key cannot be both a string value AND a parent object
  - Each key must be completely independent in the flat structure

### Testing Strategy

- Check README.md and package.json scripts for test commands
- Verify builds work with `pnpm build`
- Test photo processing with `pnpm run build:manifest`
- Validate types with `pnpm --filter web type-check`

## Cursor Rules Integration

### Code Quality Standards

- Avoid code duplication - extract common types and components when used multiple times
- Keep components focused - use hooks and component splitting for large logic blocks
- Master React philosophy - proper Context usage, component composition, state management to prevent re-renders

### UI/UX Guidelines

- Use Apple UIKit color system via tailwind-uikit-colors package
- Prefer semantic color names: `text-primary`, `fill-secondary`, `material-thin`, etc.
- Follow system colors: `red`, `blue`, `green`, `mint`, `teal`, `cyan`, `indigo`, `purple`, `pink`, `brown`, `gray`
- Use material design principles with opacity-based fills and proper contrast

### i18n Development Rules

- Use flat keys with dot notation: `exif.camera.model`
- Support pluralization: `_one` and `_other` suffixes
- Always modify English (`en.json`) first, then other languages
- Avoid key conflicts in flat structure (e.g., `exif.custom.rendered` vs `exif.custom.rendered.custom`)
- ESLint automatically removes unused keys from non-English files

## Important Notes

- This is a photo gallery application that processes and displays photos from cloud storage
- The builder tool handles complex image processing workflows
- WebGL viewer provides high-performance photo viewing experience
- Map integration shows photo locations from GPS EXIF data
- Live Photo support for iOS/Apple device videos
