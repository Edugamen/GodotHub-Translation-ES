# New UI (Beta)

This directory is the **entire New UI**, isolated from the classic app so it can
be developed on a separate branch with minimal merge conflicts.

## How it works

The classic app lives in `src/ui/classic/` and renders everything through
`AppContent` in `src/ui/classic/App.tsx`. When the `new_ui` setting is
enabled, that same shell (imported by `src/main.tsx`) swaps the **whole
UI**:

```tsx
{settings.new_ui ? <AppNew /> : <AppContent />}
```

`AppNew` (`./AppNew.tsx`) is a self-contained shell: its own top bar, its own
sidebar, and its own view area. It reuses only the **data hooks**
(`useSettings`, `useWorkspaces`, `useProjectsContext`, `useGodotVersionsContext`)
— never the classic UI components.

## Rules to keep the merge conflict-free

- **Never import classic UI** (`Sidebar`, `TitleBar`, `ProjectCard`, modals, …)
  into this directory — the classic app lives in `src/ui/classic/` and is
  off-limits. If you need a shared data hook, that's fine — hooks are logic,
  not UI.
- Every view gets its own file under `src/ui/new/views/` and is registered in
  `renderView()` in `AppNew.tsx`. Tabs without a finished view show a
  placeholder, so the shell always renders.
- New shared components go in `src/ui/new/components/`.
- Logic used **only** by the New UI lives in this folder too: `src/ui/new/lib/`
  for helpers (`duration.ts`, `icons.tsx`) and `src/ui/new/hooks/` for React
  hooks (`useScrollCompensation.ts`). Only truly shared data code (`api.ts`,
  `projectSort.ts`, data hooks, `types`) stays in the top-level `src/lib/`,
  `src/hooks/`, `src/api/`, and `src/types`.
- **Isolation is enforced by ESLint**: `bun run lint` runs the
  `godothub/no-classic-ui-imports` rule, which errors on any `src/ui/new/**`
  file importing from `src/ui/classic/**`. When the New UI
  needs a classic component, copy it into this folder instead (adjusting its
  internal imports for the new depth) — e.g. the local copies of `Tooltip`,
  `Toggle`, `Slider`, `ConfirmDialog`, `TagManagerModal`, `ImportOverlay`, and
  `ImportProgressCard` in `src/ui/new/components/`. Some are byte-identical
  copies of the classic originals today (keep changes mirrored in both until
  the classic UI is retired), while the New UI's own modals (`CreateProjectModal`,
  `CloneRepoModal`, `TemplatePreviewModal` in `src/ui/new/components/modals/`)
  are **restyled** in the New UI design language — `rounded-card`/`rounded-item`/
  `rounded-tile`/`rounded-tag` radii, `bg-overlay` inputs, `border-outline`
  chips — so they no longer mirror the classic versions exactly.
- New UI colors live in `src/ui/new/colors.css`, scoped under the `.new-ui`
  class on the `AppNew` root. Never change the shared tokens in `src/index.css`
  for New UI work — every New UI component using theme utilities (`bg-base`,
  `text-ink`, `border-line`, …) picks up the New UI palette automatically.
- `src/ui/classic/App.tsx` only touches the one-line shell swap (the
  `{settings.new_ui ? <AppNew /> : <AppContent />}` decision). Everything else
  in the classic app stays untouched.

## Scroll containers

Use `OverlayScrollArea` (from `./components/OverlayScrollArea`) for any
scrollable view. It hides the native scrollbar and renders a floating thumb
over the content's right edge, so the scrollbar **never takes layout space**
and other elements don't shift when it appears or disappears. Pass
`hideThumb` when the user has disabled scrollbars (see `ProjectsViewNew` and
`AppNew` for the pattern). It handles re-measuring on resize/content growth,
supports click-to-jump + dragging on the thumb track, and ships a back-to-top
button with a scroll progress ring (hidden while dropdown menus or dialogs
are open). Pass `scrollToTopOn` a value to watch — whenever it changes (after
mount), the view scrolls back to the top (used by the projects view's tag
filter so a narrowed list always starts at the first card).

## Adding a new view

1. Create `src/ui/new/views/FooViewNew.tsx` exporting `FooViewNew`.
2. Add a case to `renderView()` in `AppNew.tsx` (and the `TABS` list if it's a
   new tab).
3. Done — the view only renders when the toggle is on.

The toggle lives in Settings → Appearance → "New UI (Beta)". Views without a
finished implementation still show placeholders, so expect gaps while the New
UI is under construction.
