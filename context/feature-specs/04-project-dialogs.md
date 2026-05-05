## Goal

Build the `/editor` home screen and add project dialogs/sidebar actions. No API calls or persistence yet.

## Editor Home

Reuse the existing editor layout. Do not modify the navbar or sidebar behavior.

In the center of the page, add:

- heading: `Create a project or open an existing one`
- description: `Start a new architecture workspace, or choose a project from the sidebar.`
- `New Project` button with a `Plus` icon

Keep the layout minimal. Do not wrap this content in cards.

Clicking `New Project` should open the Create Project dialog.

## Dialogs

### Create Project

- **Input**: Project name input with auto-focus.
- **Validation**:
  - Min length: 1 character.
  - Max length: 50 characters.
  - Allowed characters: a-z, 0-9, space, hyphen (slugified for URL).
- **Slug Preview**: Live slug preview based on the name. Updates as the user types.
- **Actions**:
  - `Create` button (Primary): Triggers submission. Disabled if name is empty or invalid.
  - `Cancel` button (Secondary): Dismisses dialog.
- **Keyboard**: Enter to submit, Escape to close.
- **Accessibility**: 
  - ARIA-label for the dialog.
  - ARIA-describedby for the description.
  - ARIA-live for error announcements.
  - Focus trap while open.

### Rename Project

- **Input**: Prefilled project name input with auto-focus.
- **Validation**: Same as Create Project.
- **Description**: Current project name shown in the description.
- **Actions**: `Save` and `Cancel` buttons.
- **Keyboard**: Enter to submit, Escape to close.
- **Accessibility**: Same as Create Project.

### Delete Project

- **Confirmation**: Destructive confirmation only.
- **Description**: Displays the name of the project being deleted.
- **Actions**: `Delete Project` (Destructive) and `Cancel` buttons.
- **Accessibility**:
  - Destructive confirmation ARIA role.
  - Return focus to trigger on close.

## Sidebar

Add project item actions for **owned** projects only:

- **Interaction Pattern**: Actions (Rename, Delete) are visible on hover of the project item.
- **Aesthetic**: Action icons (Pencil, Trash) appear with a smooth opacity transition.
- **Affordance**: 
  - `Rename`: Opens Rename dialog.
  - `Delete`: Opens Delete dialog.
- **Accessibility**: Focusable action buttons with screen-reader labels.

### Creation

- The Sidebar includes a "New Project" button in its footer that opens the Create dialog.

On mobile:

- Tapping outside the sidebar closes it.
- Add a backdrop scrim.

## Implementation

Create a dedicated hook to manage:

- Dialog state (type, open/closed)
- Form state (name, slug, error)
- Loading state
- Submission logic (validation, mock persistence)

Wire:

- Editor Home `New Project` → Create dialog
- Sidebar Footer `New Project` → Create dialog
- Sidebar Item `Rename` → Rename dialog
- Sidebar Item `Delete` → Delete dialog

Use mock project data only. Do not add API calls or persistence.

## Check When Done

- Sidebar actions are wired and hover-triggered.
- Slug preview and validation work.
- Error messages are displayed correctly.
- Keyboard interactions (Enter/Esc) work.
- Accessibility requirements met.
- No TypeScript or lint errors.
