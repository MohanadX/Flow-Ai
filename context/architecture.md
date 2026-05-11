# Architecture Context

## Stack

| Layer            | Technology              | Role                                                           |
| ---------------- | ----------------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 + TypeScript | Full-stack app with server/client boundaries                   |
| UI               | Tailwind + shadcn/ui    | Component composition and styling                              |
| Auth             | Clerk                   | User identity and route protection                             |
| Database         | Prisma + PostgreSQL     | Relational metadata: projects, collaborators, specs, task runs |
| Client fetching  | TanStack React Query    | Client-side data fetching, caching, and mutations              |
| Canvas           | Liveblocks + React Flow | Real-time collaborative canvas, presence, and cursors          |
| Background tasks | Trigger.dev             | Durable AI generation workflows                                |
| Artifact storage | Vercel Blob             | Canvas snapshots and generated Markdown specs                  |

## System Boundaries

- app/api — Authenticated request handlers: input validation, ownership checks, task triggering, and persistence.
- trigger — Long-running background jobs: AI design generation and spec generation.
- lib — Shared infrastructure: Prisma client, access control helpers, and utilities.
- components — UI composition: canvas surfaces, sidebars, dialogs, and interactive elements.
- prisma — Database schema and generated client output.
- data — Legacy local directory. Not used for new artifacts.

## Client-Side Data Fetching

- All client-side data fetching uses **TanStack React Query** (`@tanstack/react-query`).
- A single `QueryClient` is created in `components/providers/react-query-provider.tsx` and mounted once at the root layout via `ReactQueryProvider`. `ReactQueryDevtools` is included for development.
- **`useQuery`** is used for reads (e.g. collaborator list in the share dialog). Data is cached per query key, automatically re-fetched when stale, and does not require manual loading state.
- **`useMutation`** is used for writes (invite, remove collaborator). On success, `queryClient.invalidateQueries` re-fetches the relevant query so the list updates automatically.
- Query keys follow a factory pattern: `collaboratorKeys.list(projectId)` to enable precise invalidation.
- Do **not** use `useEffect` + `useState` for data fetching in client components. Use React Query instead.

## Layout and Data Fetching Model

- `layout.tsx` files are used aggressively to minimize duplicate fetching. For example, `app/editor/layout.tsx` fetches the user's project lists exactly once, allowing nested routes like `/editor` and `/editor/[projectId]` to focus solely on their own specific tasks and avoiding redundant `listProjectGroups` queries.
- Client components dynamically derive their context (like `activeProjectId`) using `useParams()` where possible to prevent breaking the layout cache when navigating between sibling routes.

## Storage Model

- Database: metadata, ownership, relationships, and task run records.
- Vercel Blob: generated artifacts — canvas snapshots at canvas/{projectId}.json and specs at specs/{projectId}/{specId}.md.
- Project records, spec records, and task run records belong in PostgreSQL.
- Canvas content and Markdown output are stored in and retrieved from Vercel Blob.
- The blob URL is stored in the database (canvasJsonPath, filePath) as the reference to the artifact.
- Project IDs are also Liveblocks room IDs. New project creation uses a URL-safe slug plus a short random suffix so the database project ID and collaborative room ID remain aligned.

## Auth and Collaboration Model

- Every project has a single owner (Clerk user ID).
- Projects can include additional collaborators.
- Only authenticated users can access protected routes.
- Only the owner or a collaborator can mutate project resources.
- Liveblocks room tokens are issued only after verifying project membership.

## Starter System Designs

- Prebuilt templates are static canvas snapshots stored in the codebase.
- Templates are loaded into the active Liveblocks room when a user imports one.
- Import can occur on canvas creation or from within the editor at any time.
- Template data follows the same node/edge schema as user-created canvas content.
- Templates do not require a separate database record; they are resolved by template ID at import time.

## AI Generation Model

### Design Generation

- Input: user prompt, project context, and current canvas state.
- Execution: durable background task via Trigger.dev.
- Output: structured node and edge updates written into the shared Liveblocks room.

### Spec Generation

- Input: current canvas graph and project context.
- Execution: durable background task via Trigger.dev.
- Output: Markdown technical spec saved to the filesystem and linked to the project in the database.

## Invariants

1. Request handlers do not run long-lived AI work — that belongs in background tasks.
2. Metadata and large generated artifacts are stored in separate layers.
3. Auth and ownership are enforced at every mutation boundary.
4. Client components are used only where browser interactivity or real-time state requires them.
5. The canvas schema must remain consistent between user-created content and imported templates.
