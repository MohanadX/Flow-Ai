Act as a senior React performance engineer.
1- Refactor our React Flow component to eliminate heavy re-renders during shape dragging. Currently, the `moveDragPreview` function updates the `dragPreview` state via `setDragPreview` on every single pixel of movement, causing the entire `BaseCanvas` and `ReactFlow` engine to re-render continuously.

### Optimization Blueprint:

1. **Change State to Ref-driven Styling:**
   - Modify the `dragPreview` state to only store the shape's metadata payload (such as `shape`, `width`, and `height`), but **not** its real-time `x` and `y` coordinates.
   - Introduce a `const dragPreviewRef = useRef<HTMLDivElement | null>(null);` to get direct access to the preview DOM element.

2. **Update `moveDragPreview` to use Direct DOM Manipulation:**
   - In `moveDragPreview`, stop calling `setDragPreview` with live coordinates.
   - Instead, directly manipulate the style of `dragPreviewRef.current`. Use hardware-accelerated CSS: `transform = translate3d(${event.clientX - preview.width / 2}px, ${event.clientY - preview.height / 2}px, 0)`.
   - Ensure the initial coordinate positioning is correctly applied using the same transform method upon drag start inside `handleShapeDragStart`.

3. **Refactor `<ShapeDragPreview>` Component:**
   - Update `ShapeDragPreview` to accept the `dragPreviewRef` as a prop.
   - Render it as a `fixed` container element but strip out the inline `style` tags that depend on live-state coordinate evaluations. Allow its position to be controlled purely by the direct style transformations applied in step 2.

2- Optimize the high-frequency presence updates in our Liveblocks React Flow canvas. Currently, both `handlePointerMove` and the inner `handlePointerPresence` (inside `ShapePanel`) spam `updateMyPresence` on every single mouse movement, causing severe network congestion and CPU overhead.

### Optimization Blueprint:

1. **Implement Stable Throttling for Presence:**
   - Use our ready-made helper `throttle` function (e.g., from `lib/utils.ts`)
   - Create a stable, throttled presence update function inside `BaseCanvas` using `useMemo` with a 33ms limit (~30 FPS).
   - Use a `useRef` pointing to the latest `updateMyPresence` to avoid stale closures without breaking the `useMemo` reference memory hook.

2. **Refactor Hover Handlers:**
   - Update `handlePointerMove` to use this new throttled function.
   - Update the `ShapePanel` component's inline `handlePointerPresence` to also use this throttled tracker.
   - Ensure `handlePointerLeave` bypasses the throttle to immediately send `{ cursor: null }` when the mouse leaves the workspace, giving instant feedback.
   - Add a clean-up `useEffect` that calls `.cancel()` on the throttled function on component unmount to prevent lingering memory leaks.

Please rewrite these handlers and provide the fully optimized layout.
Refactor these sections of our file, ensuring all TypeScript types are fully preserved and the canvas remains perfectly responsive.

if you had any further suggestions expose them before implementing them

AI Suggestions:

- requestAnimationFrame for Local Drags: Currently the throttle function uses setTimeout. For network presence updates, 33ms is perfect. For the local visual drag preview, direct DOM manipulation works well, but we can ensure it's perfectly synced with the display refresh rate by wrapping the style updates in requestAnimationFrame. (The blueprint currently implies direct updates in the event handler, which is generally fine for drag events, but rAF can prevent rare visual tearing).

- Throttle Configuration: We might want to expose the 33ms limit as a configurable constant (e.g., PRESENCE_THROTTLE_MS) for easier tuning later.
