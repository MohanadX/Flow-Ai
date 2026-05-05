# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 3: Authentication

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
  - Cleaned up Sidebar UI: removed misleading `cursor-pointer`, added hover-triggered actions
  - Lifted state management to the `EditorPage` level using the `useProjectDialogs` hook
  - Passed dialog state and handlers through `EditorChrome` to the sidebar and dialog components via props
  - Unified project data types across the sidebar and dialogs using the `owned` property
  - Updated Editor Home screen (`/editor`) with welcome text and New Project button
  - Updated Project Sidebar with project actions (rename, delete) and hook-managed project state
  - Added mobile responsiveness (backdrop, close on outside click) to sidebar
  - `npm run build` passes with zero errors

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

## Session Notes

- shadcn init created `components.json` with style "radix-nova", RSC enabled, lucide icon library
- The `dark` class is applied to `<html>` in `app/layout.tsx` to force dark mode
- All 7 required components verified present in `components/ui/`
