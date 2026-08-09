# New UI (Beta)

This directory is the **entire New UI**, isolated from the classic app so it can
be developed on a separate branch with minimal merge conflicts.

## How it works

The classic app renders everything through `AppContent` in `src/App.tsx`. When
the `new_ui` setting is enabled, `App.tsx` swaps the **whole shell**:

```tsx
{settings.new_ui ? <AppNew /> : <AppContent />}
```

`AppNew` (`./AppNew.tsx`) is a self-contained shell: its own top bar, its own
sidebar, and its own view area. It reuses only the **data hooks**
(`useSettings`, `useWorkspaces`, `useProjectsContext`, `useGodotVersionsContext`)
— never the classic UI components.

## Rules to keep the merge conflict-free

- **Never import classic UI** (`Sidebar`, `TitleBar`, `ProjectCard`, modals, …)
  into this directory. If you need a classic data hook, that's fine — hooks are
  logic, not UI.
- Every view gets its own file under `src/ui/new/views/` and is registered in
  `renderView()` in `AppNew.tsx`. Tabs without a finished view show a
  placeholder, so the shell always renders.
- New shared components go in `src/ui/new/components/`.
- New UI colors live in `src/ui/new/colors.css`, scoped under the `.new-ui`
  class on the `AppNew` root. Never change the shared tokens in `src/index.css`
  for New UI work — every New UI component using theme utilities (`bg-base`,
  `text-ink`, `border-line`, …) picks up the New UI palette automatically.
- `src/App.tsx` only touches the one-line shell swap. Everything else in the
  classic app stays untouched.

## Adding a new view

1. Create `src/ui/new/views/FooViewNew.tsx` exporting `FooViewNew`.
2. Add a case to `renderView()` in `AppNew.tsx` (and the `TABS` list if it's a
   new tab).
3. Done — the view only renders when the toggle is on.

The toggle lives in Settings → Appearance → "New UI (Beta)". Views without a
finished implementation still show placeholders, so expect gaps while the New
UI is under construction.
