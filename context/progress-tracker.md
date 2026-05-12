# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 12: Shape panel (complete)

## Current Goal

- Done. Ready for the next canvas feature unit.

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
- Project API hardening:
  - Removed the create-project ID pre-check race and mapped Prisma `P2002` ID conflicts to the existing `PROJECT_ID_CONFLICT` 409 response
- 08-editor-workspace-shell:
  - Created `components/editor/access-denied.tsx` with lock icon and return link
  - Created `lib/project-access.ts` for evaluating user access against Prisma records
  - Updated `/editor/[projectId]/page.tsx` to be a server component enforcing project access checks
  - Updated workspace layout (`EditorChrome`) to include canvas and AI right sidebar placeholders
  - Added Share button and AI toggle actions to `EditorNavbar`, showing the active project name
  - Added radial gradient background to the canvas placeholder for a dynamic, sleek look
- UI & Polish:
  - Added brand color glowing effect to the active project item in the sidebar using `bg-brand/10`, `text-brand`, and drop-shadow variables
  - Enhanced canvas placeholder in `/editor/[projectId]` with conic light rays (`--color-brand-dim`), radial gradients, and a glowing compass emoji container for a premium feel
- Layout Optimization:
  - Extracted `EditorChrome` to a shared `app/editor/layout.tsx` to fetch `listProjectGroups` only once
  - Refactored `EditorChrome` to infer `activeProjectId` using `useParams()` instead of props
  - Passed `projectActions.openCreate` downward using a new `EditorActionContext` for `app/editor/page.tsx`
  - Replaced duplicate DB fetch calls across editor routes and prevented full layout re-renders on project navigation

- 09-share-dialog:
  - Created `lib/collaborator-service.ts` with list, invite, remove helpers and Clerk enrichment (display name + avatar via `clerkClient().users.getUserList`)
  - Added `GET /api/projects/[projectId]/collaborators` (accessible to owner and collaborators)
  - Added `POST /api/projects/[projectId]/collaborators` (owner-only invite, maps Prisma P2002 to 409 `ALREADY_COLLABORATOR`)
  - Added `DELETE /api/projects/[projectId]/collaborators/[email]` (owner-only remove)
  - Created `components/editor/share-dialog.tsx` with collaborator list, invite input, remove buttons, copy-link button with `Copied!` feedback, owner vs. read-only modes, and Clerk avatar/name display
  - Wired `Share` button in `EditorNavbar` via new `onShare` prop and `isShareOpen` state in `EditorChrome`
  - `npm run build` passes with zero errors
- React Query setup:
  - Installed `@tanstack/react-query` and `@tanstack/react-query-devtools`
  - Created `components/providers/react-query-provider.tsx` — single `QueryClient` with 30 s stale time, `ReactQueryDevtools` in development
  - Mounted `ReactQueryProvider` in root `app/layout.tsx` so all client components share one cache
  - Migrated `components/editor/share-dialog.tsx` from manual `useEffect`/`useState` fetching to `useQuery` (collaborator list) and `useMutation` (invite + remove) with query-key invalidation on success
  - `npm run build` passes with zero errors
- Share dialog polish:
  - Extended `GET /api/projects/[projectId]/collaborators` to return `{ owner: OwnerDto, collaborators: CollaboratorDto[] }` — owner enriched with Clerk name and avatar in the same request
  - Added `OwnerDto` and `CollaboratorListDto` types to `lib/collaborator-service.ts`; owner Clerk lookup reuses the already-fetched `callerUser` when the viewer is the owner to avoid a redundant API call
  - Owner row now appears pinned at the top of the member list — styled `bg-brand/10 border-brand/20`; carries a pill badge `Owner` in `text-brand / border-brand/30` matching the brand color theme
  - Extracted a reusable `MemberAvatar` sub-component inside `share-dialog.tsx` to avoid duplicating avatar/initial logic
  - Added `img.clerk.com` to `next.config.ts` `images.remotePatterns` so Clerk avatars render via `next/image`
  - `npx tsc --noEmit` passes with zero errors

- Current issue fixes:
  - Logged failed Clerk owner lookups in `lib/collaborator-service.ts` with owner ID and caller context before falling back to a null owner profile
  - Changed collaborator Clerk enrichment to fetch email matches in 500-address batches so projects with more than 500 collaborators are not truncated by a single request limit
  - Added a workspace access-check error fallback in `/editor/[projectId]` while preserving `AccessDenied` for missing or unauthorized projects
  - Cleared the share dialog copy-link timeout on repeat copy and unmount to avoid state updates after unmount
  - Memoized active project lookup in `EditorChrome`
  - `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass with zero errors
- Current UI issue fixes:
  - Kept the project sidebar and AI sidebar as fixed overlay panels on all breakpoints so neither one pushes or resizes the center editor canvas
  - Moved the shape panel into the React Flow tree so Liveblocks cursor presence remains active when hovering the bottom shape toolbar
  - Added explicit shape panel pointer presence updates using React Flow screen-to-canvas coordinates so Liveblocks cursors do not disappear over toolbar controls
  - `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass with zero errors
- 10-liveblocks-setup:
  - Created `liveblocks.config.ts` with typed Presence (`cursor`, `isThinking`) and UserMeta (`displayName`, `avatarUrl`, `cursorColor`)
  - Created `lib/liveblocks.ts` with a cached, lazy Liveblocks node client and deterministic user ID to cursor color mapping
  - Added `POST /api/liveblocks-auth` to require Clerk auth, verify project access, create the Liveblocks room if needed, and issue a room-scoped session token
  - Liveblocks auth attaches user display name, avatar URL, and generated cursor color to session metadata
  - `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass with zero errors
- 11-base-canvas:
  - Created shared canvas types in `types/canvas.ts` with node data (`label`, `color`, `shape`), `NODE_SHAPES`, `canvasNode`, and `canvasEdge`
  - Created `components/editor/collaborative-canvas.tsx` as the client-side Liveblocks/React Flow wrapper
  - Added `LiveblocksProvider`, `RoomProvider`, initial presence (`cursor: null`, `isThinking: false`), `ClientSideSuspense`, and a canvas error fallback
  - Wired `useLiveblocksFlow({ suspense: true })` to React Flow with empty initial nodes and edges
  - Rendered the base canvas with loose connections, `fitView`, `MiniMap`, dot-pattern background, and Liveblocks cursors
  - Replaced the `/editor/[projectId]` workspace placeholder while keeping the page server-side
  - Imported React Flow and Liveblocks canvas styles globally
  - `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass with zero errors
- 12-shape-panel:
  - Added shared shape drag metadata in `types/canvas.ts`, including default sizes and `SHAPE_DRAG_MIME_TYPE`
  - Added a floating bottom-center pill toolbar with draggable icon buttons for rectangle, diamond, circle, pill, cylinder, and hexagon
  - Shape drag payloads include the shape name and default width/height
  - Added canvas `dragover` and `drop` handling in `components/editor/collaborative-canvas.tsx`
  - Drop handling validates the payload, converts screen coordinates to React Flow canvas coordinates, and creates a new `canvasNode`
  - New node IDs use the shape name, timestamp, and a local counter
  - New nodes use an empty label, the default node color, the dragged shape value, and the dragged default size
  - Added a basic `canvasNode` renderer that displays every shape as a bordered rectangle with centered label text
  - `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass with zero errors

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
- `app/editor/layout.tsx` acts as a shared layout to fetch project lists only once. `EditorChrome` reads `projectId` from URL params to minimize duplicate fetching between `app/editor` and `app/editor/[projectId]` routes.
- All client-side data fetching uses TanStack React Query. `useQuery` handles reads with caching; `useMutation` handles writes and invalidates the relevant query key on success. Manual `useEffect`+`setState` fetching is not used in client components.
- Liveblocks rooms are created as private rooms (`defaultAccesses: []`), and the app issues scoped session tokens only after project access is verified.

## Session Notes

- shadcn init created `components.json` with style "radix-nova", RSC enabled, lucide icon library
- The `dark` class is applied to `<html>` in `app/layout.tsx` to force dark mode
- All 7 required components verified present in `components/ui/`
- Prisma migration `20260509082106_init_projects` was applied successfully to the configured PostgreSQL database.
- Next.js 16 route handlers require awaiting dynamic `params`, so `/api/projects/[projectId]` uses promise-based route context parameters.
- The required `context/architecture-context.md` file is currently named `context/architecture.md`; that file was used for architecture context in this feature.
- `LIVEBLOCKS_SECRET_KEY` is required at runtime for `/api/liveblocks-auth`; the Liveblocks client is lazy so production builds do not fail during route module import.
