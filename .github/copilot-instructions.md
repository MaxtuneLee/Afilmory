# Afilmory Codebase Guide for AI Agents

## Project Architecture

Afilmory is a modern photo gallery monorepo with sophisticated image processing capabilities:

- **`apps/ssr/`** - Next.js 15 SSR application with database and APIs
- **`apps/web/`** - React 19 frontend with Vite, WebGL viewer, masonry layout
- **`packages/builder/`** - Photo processing engine with S3/GitHub storage adapters
- **`packages/docs/`** - Vite SSG documentation site (planned custom implementation)
- **`packages/webgl-viewer/`** - High-performance WebGL photo viewer component

## Critical Development Commands

```bash
# Photo processing & manifest generation
pnpm run build:manifest                    # Incremental photo sync
pnpm run build:manifest -- --force         # Full rebuild
pnpm run build:manifest -- --force-thumbnails  # Regenerate thumbnails only

# Development servers
pnpm dev                                   # Starts both SSR + web apps
pnpm --filter @afilmory/ssr dev           # SSR only (Next.js on :1924)
pnpm --filter web dev                     # Web only (Vite)

# Database operations (SSR app)
pnpm --filter @afilmory/ssr db:generate   # Generate Drizzle migrations
pnpm --filter @afilmory/ssr db:migrate    # Run migrations
```

## Code Quality & Architecture Patterns

### State Management Architecture

- **Jotai** for client state in web app - use atomic patterns, avoid large atoms
- **TanStack Query** for server state - leverage cache invalidation patterns
- **React Context** - follow composition over deep nesting, prevent re-renders

### Photo Processing Pipeline

1. **Storage Adapters** (`packages/builder/src/storage/`) - implement `StorageProvider` interface
2. **Format Conversion** - HEIC/TIFF → web formats via Sharp
3. **EXIF Extraction** - camera settings, GPS, Fujifilm recipes
4. **Concurrent Processing** - worker threads/cluster mode in `builderConfig.performance`

### WebGL Integration

- Custom WebGL viewer in `packages/webgl-viewer/` for high-performance rendering
- Gesture support, zoom/pan operations
- Integration with masonry layout via Masonic

## Project-Specific Conventions

### Configuration System

- **`builder.config.json`** - photo processing, storage, performance settings
- **`config.json`** - site metadata merged with `site.config.ts` defaults
- **`env.ts`** - centralized environment validation with Zod schemas

### Apple UIKit Color System

```typescript
// Use semantic Tailwind classes from tailwindcss-uikit-colors
className = 'text-text-primary bg-fill-secondary material-thin'
// NOT generic colors like "text-blue-500"
```

### i18n Flat Key Structure

```json
// locales/app/en.json - use dot notation, avoid nesting
{
  "exif.camera.model": "Camera Model",
  "photo.count_one": "{{count}} photo",
  "photo.count_other": "{{count}} photos"
}
```

### Monorepo Workspace Patterns

- Use `pnpm --filter <package>` for targeted operations
- Shared dependencies in `pnpm-workspace.yaml` catalog
- Cross-package imports via workspace protocol: `"@afilmory/components": "workspace:*"`

## Storage Provider Integration

When extending storage support, implement the adapter pattern:

```typescript
// packages/builder/src/storage/providers/
class NewStorageProvider implements StorageProvider {
  async listImages(): Promise<StorageObject[]> {
    /* */
  }
  async getFile(key: string): Promise<Buffer | null> {
    /* */
  }
  // Key methods for storage abstraction
}
```

## Performance Considerations

- **Photo Processing**: Configure worker pools in `builderConfig.performance.worker`
- **WebGL Viewer**: Implement texture memory management and disposal
- **Bundle Splitting**: Leverage Vite's code splitting for image processing tools
- **Image Optimization**: Use Sharp for thumbnails, Blurhash for placeholders

## Documentation Site (packages/docs/)

Currently planned as a custom Vite SSG implementation:

- **MDX** with React components, math (KaTeX), charts (Mermaid)
- **Custom Vite plugins** for file-system routing and search indexing
- **Design system** aligned with main app's Apple UIKit colors
- Reference `packages/docs/requirements.md` and `tasks.md` for implementation details

## Integration Points

- **Database**: Drizzle ORM with PostgreSQL for SSR app
- **Image CDN**: S3-compatible storage with custom domain support
- **Map Integration**: MapLibre for GPS photo locations
- **Live Photos**: iOS video detection and playback support
- **RSS/Social**: OpenGraph metadata and feed generation

## Other Considerations

- Don't have to implement everything at once; focus on core features first
- Use existing packages as references for implementation patterns
- Follow the established architecture for consistency
- Keep documentation up-to-date with code changes
- If you need to run commands, ask for help, don't run them blindly
