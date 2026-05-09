# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 7: Wire editor chrome to real project APIs (complete)

## Current Goal

- Done. Ready for next feature unit.

## Completed

- Phase 1: Design System & UI Primitives — Complete
- Phase 2: Editor Shell — Complete
- Phase 3: Authentication — Complete
- 01-design-system:
  - Installed and configured shadcn/ui (Radix + Nova preset, Tailwind v4)
  - Added 7 UI components: Button, Card, Dialog, Input, Tabs, TextArea, ScrollArea
  - Installed lucide-react for icons
  - Created `lib/utils.ts` with reusable `cn()` function (clsx + tailwind-merge)
  - Customized `globals.css` with project dark theme tokens from ui-context.md
  - Mapped all project design tokens to Tailwind utilities (bg-base, text-copy-primary, text-brand, etc.)
  - Forced dark mode on `<html>` element (dark-only, no light mode)
  - `npm run build` passes with zero errors
- 02-editor:
  - Created `components/editor/editor-navbar.tsx` (fixed-height, sidebar toggle button)
  - Created `components/editor/project-sidebar.tsx` (floats above canvas, slides in from left, Tabs)
  - Verified Dialog Pattern using global color tokens
  - `npm run build` passes with zero errors
- 03-auth:
  - Installed @clerk/nextjs and @clerk/ui
  - Wrapped root layout with ClerkProvider using dark theme and project CSS variables
  - Created `proxy.ts` to protect all routes except public auth paths
  - Updated root `/` route to redirect to `/editor` or `/sign-in`
  - Created custom sign-in and sign-up pages using Clerk components in `app/(auth)` with two-panel layout
  - Added UserButton to `components/editor/editor-navbar.tsx`
  - `npm run build` passes with zero errors
- 04-project-dialogs:
  - Implemented all project-related dialogs (Create, Rename, Delete) in a single component `ProjectDialogs` at `components/editor/project-dialogs.tsx`
  - Refined dialog specs with validation (min/max length), error handling, and accessibility requirements
  - Added live slug preview and validation to `useProjectDialogs` hook using updated `slugify` utility
  - Improved keyboard interactions (Enter to submit) in all dialogs
  - Fixed accessibility issues: `inert` attribute on sidebar, ARIA labels, and focus management
  - Lifted state management to the `EditorPage` level using the `useProjectDialogs` hook
  - Passed dialog state and handlers through `EditorChrome` to the sidebar and dialog components via props
  - Unified project data types across the sidebar and dialogs using canonical `isOwner/ownerId` properties from `types/project.ts`
  - Added loading guards to submission handlers and keydown events to prevent duplicate project creation
  - Refactored `useProjectDialogs` to improve validation flow and guard against concurrent calls
  - Updated Editor Home screen (`/editor`) with welcome text and New Project button
  - Updated Project Sidebar with project actions (rename, delete) and hook-managed project state
  - Added mobile responsiveness (backdrop, close on outside click) to sidebar
  - `npm run build` passes with zero errors
- 05-prisma:
  - Added `ProjectStatus` enum with `DRAFT` and `ARCHIVED` statuses
  - Added `Project` model with Clerk owner ID, name, optional description, status, canvas blob path reference, timestamps, and owner/date indexes
  - Added `ProjectCollaborator` model with cascade project relation, collaborator email, creation timestamp, unique project/email constraint, and email/project-date indexes
  - Created cached Prisma singleton at `lib/prisma.ts`
  - Prisma client branches by `DATABASE_URL`: `prisma+postgres://` uses `accelerateUrl`, direct URLs use `@prisma/adapter-pg`
  - Updated Prisma config to load Next.js env files so `.env.local` works for CLI commands
  - Created and applied migration `20260509082106_init_projects`
  - Ran `npx prisma generate`
  - `npm run build` passes with zero errors
- 06-project-apis:
  - Added `GET /api/projects` to list projects owned by the authenticated Clerk user
  - Added `POST /api/projects` to create projects with the authenticated Clerk user as `ownerId`
  - Defaults missing or blank create names to `Untitled Project`
  - Added `PATCH /api/projects/[projectId]` for owner-only project rename
  - Added `DELETE /api/projects/[projectId]` for owner-only project deletion
  - Added shared API helpers for `401`, `403`, `404`, validation errors, and consistent JSON error bodies
  - Added project service helpers for name validation, project serialization, and Prisma access checks
  - `npm run build` passes with zero errors
- 07-wire-editor-chrome:
  - Converted `/editor` back to a server component that fetches project lists before render
  - Added owned/shared project grouping via the project service using owner ID and collaborator email matches
  - Replaced mock project dialog state with `useProjectActions` for create, rename, delete, refresh, and navigation behavior
  - Added URL-safe client-generated project room IDs and allowed `POST /api/projects` to persist them as project IDs
  - Wired the sidebar tabs to real owned and shared project lists
  - Added project navigation from sidebar rows to `/editor/[projectId]`
  - Added a minimal `/editor/[projectId]` workspace route so new projects navigate to an active workspace
  - Delete redirects to `/editor` when deleting the active workspace and refreshes otherwise
  - `npm run build` passes with zero errors
- Dialog polish:
  - Capped project name dialog inputs at the existing 50-character validation limit
  - Wrapped long room ID previews and project names inside project dialogs so long values do not overflow the modal

## In Progress

- None.

## Next Up

- Canvas implementation (Real-time collaborative canvas with React Flow and Liveblocks)

## Open Questions

- None.

## Architecture Decisions

- Using shadcn/ui (Radix + Nova preset) with Tailwind v4 for component library (per ui-context.md)
- Components live in `components/ui/` — generated files are not modified after installation
- Both `:root` and `.dark` CSS blocks contain identical dark palette values since the app is dark-only
- Project design tokens (bg-base, text-copy-primary, text-brand, etc.) are defined alongside shadcn semantic tokens in globals.css
- Using lifted state at the `EditorPage` level for project dialog management.
- All project dialogs (Create, Rename, Delete) are consolidated into a single component (`components/editor/project-dialogs.tsx`) for easier maintenance and consistency.
- This approach provides a clear, dependency-free implementation using standard React state lifting and prop passing.
- Prisma CLI configuration uses Next.js env loading so development secrets in `.env.local` are available to migrations and generation.
- Prisma server client module explicitly loads dotenv before reading `DATABASE_URL` for Prisma v7 runtime compatibility.
- Project API routes return JSON envelopes (`{ projects }`, `{ project }`, or `{ error }`) and keep Prisma query/mutation logic in `lib/project-service.ts`.
- New project creation uses a URL-safe slug plus short random suffix as the project ID so the project ID and Liveblocks room ID remain the same.

## Session Notes

- shadcn init created `components.json` with style "radix-nova", RSC enabled, lucide icon library
- The `dark` class is applied to `<html>` in `app/layout.tsx` to force dark mode
- All 7 required components verified present in `components/ui/`
- Prisma migration `20260509082106_init_projects` was applied successfully to the configured PostgreSQL database.
- Next.js 16 route handlers require awaiting dynamic `params`, so `/api/projects/[projectId]` uses promise-based route context parameters.
- The required `context/architecture-context.md` file is currently named `context/architecture.md`; that file was used for architecture context in this feature.
