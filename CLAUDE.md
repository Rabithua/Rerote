# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun run dev` - Start dev server on port 4000
- `bun run build` - Build for production
- `bun run test` - Run tests (Vitest)
- `bun run lint` - Run ESLint
- `bun run format` - Run Prettier
- `bun run check` - Format with Prettier and fix with ESLint

## Project Architecture

Rerote is a data conversion tool built with TanStack Start, designed to convert data from various platforms to Rote format.

### Tech Stack

- **Framework**: TanStack Start (React + Vite)
- **Routing**: TanStack Router (file-based routing)
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest with Testing Library
- **Build**: Vite

### Key Directories

- `src/routes/` - File-based routes (auto-generated route tree)
- `src/components/converter/` - Converter UI components
- `src/lib/converters/` - Platform-specific conversion logic
- `src/lib/utils/` - Utility functions (file operations, etc.)
- `src/components/ui/` - Reusable UI components

### Conversion System Architecture

The converter follows a plugin-based architecture defined in `src/lib/converters/index.ts`:

1. **Converter Interface**: Each platform implements a `Converter` interface with:
   - `validate(data)` - Check if data can be processed
   - `convert(data)` - Transform to Rote format
   - `supportedModes` - Array of modes: `['file']`, `['api']`, or both

2. **Data Flow**:
   - User selects platform (Memos, etc.)
   - Chooses input mode (file upload or API connection)
   - Converter validates input → transforms → produces `ConversionResult`
   - Output is downloadable JSON

3. **Current Implementation**:
   - `memos-to-rote.ts` - Memos to Rote conversion logic
   - `memos-api.ts` - Memos API client with pagination and auth
   - `types.ts` - Shared types across converters

### Adding a New Platform

1. Create converter function in `src/lib/converters/` (e.g., `notion-to-rote.ts`)
2. Add platform to `Platform` enum and `converters` array in `index.ts`
3. Define source types in `types.ts`
4. Implement `Converter` interface with validate/convert methods

### Routing

Routes are auto-generated from `src/routes/` files. The route tree is generated via TanStack Router plugin and written to `src/routeTree.gen.ts`. Use `createFileRoute('/path')` to define routes.

### Import Paths

Use `@/*` alias for imports from `src/` (configured in `tsconfig.json` paths).

## Coding Standards

### UI Design Principles

1. **Keep UI simple and flat** - Avoid excessive nesting and decorative elements
   - Prefer simple flex layouts over grid when appropriate
   - Avoid unnecessary borders, shadows, and decorative spacing
   - Remove unused shadcn/ui subcomponents (e.g., use `AlertDialogContent` directly without `AlertDialogHeader`/`AlertDialogFooter`/`AlertDialogDescription` when they add unnecessary structure)
   - Example: Dialogs/modals should use a simple flat structure with clear visual hierarchy

2. **Color palette** - Black, white, and 50% gray as accent color
   - Do not use semantic colors (green, amber, red, blue, etc.)
   - Primary: `text-white`, `text-black`, `text-muted-foreground`
   - Accent: `text-gray-500` / `bg-gray-500` (50% gray for emphasis)
   - Background: `bg-white`, `bg-black`, `bg-muted`, `bg-background`, `bg-gray-50`

3. **Spacing** - Use flex gap or space utility classes
   - Prefer `gap-*` with flex layouts over margin/padding on children
   - Use `space-y-*` / `space-x-*` for vertical/horizontal spacing
   - Avoid manual padding/margin when gap utilities suffice

4. **Typography** - Keep it clean
   - Headings: `text-lg font-semibold`
   - Body text: `text-sm text-muted-foreground`
   - Numbers/stats: `text-2xl font-bold tabular-nums`
   - Labels: `text-xs text-muted-foreground`

### Code Style

1. **Component structure**
   - Prefer functional components with hooks
   - Use `useCallback` for event handlers passed as props
   - Keep component files focused on a single responsibility

2. **Imports**
   - Group imports in this order: React hooks, external libraries, internal modules, components
   - Remove unused imports

3. **TypeScript**
   - Use interfaces for object shapes
   - Prefer `type` for unions, intersections, and simple types
   - Avoid `any` - use proper types or `unknown`

### React Best Practices

1. **State management**
   - Keep state as local as possible
   - Use the simplest state primitive that works (boolean for toggles, enum for mutually exclusive states)
   - Derive computed values where possible instead of storing in state

2. **Event handlers**
   - Use `useCallback` for handlers passed to child components
   - Name handlers descriptively: `handle*`, `on*`

3. **Props**
   - Define prop interfaces explicitly
   - Use descriptive prop names
   - Keep prop interfaces in the same file unless shared across multiple components
