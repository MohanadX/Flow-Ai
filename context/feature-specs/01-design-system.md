Read `AGENTS.md` before starting.

We're adding the design system and UI primitive components.

install and configure `shadcn/ui`

add these components:

- Button
- Card
- Dialog
- Input
- Tabs
- TextArea
- ScrollArea

Do not modify the generated `components/ui/*` files after installation

Also Install `lucide-react` for icons

Create `lib/utils.ts` with a reusable `cn()` function for Tailwind CSS class merging.

Ensure all components match the existing dark theme in `globals.css`.

### Check when done

- All components import without errors
- `cn()` works properly
- No default light styling appears
