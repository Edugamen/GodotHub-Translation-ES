# Contributing to GodotHub

First off, thank you for wanting to contribute! 🎉 GodotHub is a community-driven
project, and every issue filed, translation added, bug fixed, or feature built
makes it better for everyone.

This guide covers everything you need to know: setting up a dev environment,
finding something to work on, code conventions, and in depth, how
**localization** works and how to add or improve a language.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Ways to Contribute](#-ways-to-contribute)
- [Setting Up a Dev Environment](#-setting-up-a-dev-environment)
- [Running the App](#-running-the-app)
- [Project Structure](#-project-structure)
- [Development Workflow](#-development-workflow)
- [Code Conventions](#-code-conventions)
- [Localization (in depth)](#-localization-in-depth)
- [Testing & CI](#-testing--ci)
- [Release Process](#-release-process)
- [Getting Help](#-getting-help)

---

## 🤝 Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind,
be patient, and assume good intent. This project is made by people from all
over the world.

---

## 💡 Ways to Contribute

You don't have to write code to help:

| Contribution | What it involves |
|---|---|
| **Report a bug** | Open an issue with steps to reproduce, expected vs. actual behavior, and your OS + app version. |
| **Request a feature** | Open an issue describing *what* you want and *why*. Screenshots/mockups help a lot. |
| **Translate** | Add or improve a language in `src/i18n/`. No Rust or TypeScript needed. See the [Localization section](#-localization-in-depth). |
| **Test** | The app is only heavily tested on Windows, Arch Linux (Hyprland), and recent macOS. Try a nightly/dev build on your setup and report what breaks. |
| **Write docs** | Improve the README, this file, or add FAQ content. |
| **Fix a bug / build a feature** | The classic path, see below. |

### Finding something to work on

- Look through the [issues](https://github.com/RykoTheDev/GodotHub/issues) for
  `good first issue` labels.
- If you want to take on an issue, **comment on it first** so nobody else
  starts the same work. Maintainers will happily assign it to you.
- **Open an issue before starting large changes**. A quick "I'd like to
  refactor X / add Y" saves everyone from a PR that goes in a direction the
  project doesn't want.

---

## 🛠️ Setting Up a Dev Environment

### Prerequisites

| Tool | Why | Notes |
|---|---|---|
| **Node.js 20+** | Frontend tooling | Any recent LTS works. |
| **Bun** | Package manager & build tool | Install from [bun.sh](https://bun.sh). The repo's lockfile is `bun.lock`. |
| **Rust (stable)** | Tauri backend | Install via [rustup](https://rustup.rs). |
| **Tauri system deps** | Native webview | **Linux** needs `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `patchelf`, and friends. **Windows/macOS** need nothing extra (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)). |
| **Git** | Version control | Also required by the app's Git features. |

### 1. Clone & install

```bash
git clone https://github.com/RykoTheDev/GodotHub.git
cd GodotHub
bun install
```

### 2. Verify the toolchain

```bash
bun run lint          # ESLint
bunx tsc --noEmit     # TypeScript typecheck
cd src-tauri && cargo check   # Rust typecheck (first run is slow)
```

All three should pass before you start.

---

## ▶️ Running the App

### Dev mode (hot reload)

```bash
bun run tauri dev
```

This builds the Rust backend and starts Vite with hot-reload for the frontend.
The app window opens with the **New UI** by default (switch to the classic UI
from the titlebar menu if you need it).

### Building a release

```bash
bun run tauri:build
```

On Linux this also runs the AppImage Wayland patch script. The output lands in
`src-tauri/target/release/`.

### Useful scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Frontend only (Vite dev server, no Tauri window) |
| `bun run lint` | Run ESLint |
| `bunx tsc --noEmit` | TypeScript typecheck |
| `cd src-tauri && cargo check` | Rust typecheck (no codegen, faster) |
| `bun run tauri dev` | Full app in dev mode |
| `bun run tauri:build` | Full release build |

---

## 📁 Project Structure

```
godothub/
├── src/                        # Frontend (React + TypeScript)
│   ├── main.tsx                # Entry point
│   ├── types.ts                # Shared TypeScript types
│   ├── api/                    # Tauri command bindings
│   ├── hooks/                  # React hooks & contexts
│   ├── lib/                    # Shared helpers (api.ts, useApiData, naming…)
│   ├── i18n/                   # Localization (see the dedicated section below)
│   └── interface/
│       ├── classic/            # The original UI
│       │   ├── components/     #   cards/, git/, modals/, titlebar/, ui/…
│       │   └── views/          #   ProjectsView, SettingsView, ChangelogView…
│       └── new/                # The new UI (isolated from classic)
│           ├── App.tsx         #   Self-contained shell
│           ├── style.css       #   Design tokens (scoped to new UI)
│           ├── components/     #   cards/, git/, modals/, reusables/, titlebar/, ui/
│           └── views/          #   ProjectsView, SettingsView, VersionsView…
├── src-tauri/                  # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs              # Tauri setup + command registration
│   │   ├── git.rs              # Git operations
│   │   ├── git_auth.rs         # OAuth device flow, PATs, remote repo creation
│   │   ├── projects.rs         # Project CRUD, launch
│   │   ├── godot_versions.rs   # Version download/install
│   │   └── …                   # settings, workspace, news, tray, watcher…
│   ├── licenses/               # License texts (MIT, Apache-2.0, GPL-3.0, Unlicense)
│   └── Cargo.toml
├── .github/workflows/          # CI + release pipelines
└── package.json
```

**The two UIs are intentionally isolated.** The new UI (`src/interface/new/`)
must *never* import from the classic UI, an ESLint rule
(`godothub/no-classic-ui-imports`) enforces this. If a component is needed in
both, it belongs in a shared location (`src/lib/`, `src/hooks/` folders), and anything UI-specific should be duplicated rather than cross-imported.

---

## 🧑‍💻 Development Workflow

### Branch & PR basics

1. Create a branch off `main`:
   ```bash
   git checkout -b fix/your-descriptive-name
   # or: feat/…, refactor/…, docs/…
   ```
2. Make your changes. Keep commits small and focused.
3. Run the checks (see below), **the CI runs all three**, so passing locally
   is expected before opening a PR.
4. Push and open a pull request against `main`. Reference the issue number in
   the PR description (`Closes #123`).

### Checks that must pass

```bash
bun run lint
bunx tsc --noEmit
cd src-tauri && cargo check
```

The CI (`ci.yml`) runs all of these on Windows, macOS, and Linux for every push
and PR, so don't worry about cross-platform issues you can't test locally,
but do mention which platform you *did* test on in the PR.

### ⚠️ The locale rule (important!)

> **When you change or add any user-facing string, only touch the English
> locale files (`src/i18n/locales/en-US/`).**
>
> Do **not** translate into the other languages (zh-CN, ru-RU, ar-MA) yourself.
> Untranslated keys fall back to English automatically, so the app stays fully
> functional. Native speakers pick up the new keys afterwards, mixing machine
> or half-correct translations into other locales creates a mess that's hard
> to clean up.

### Commit style

- Write clear, imperative commit messages: `Fix project icon not refreshing`,
  not `fix stuff`.
- One logical change per commit. If you touched formatting, keep it in its own
  commit so review diffs stay readable.
- Reference issues where relevant.

---

## 🎨 Code Conventions

### TypeScript / React

- TypeScript stricts no `any` unless there is genuinely no better option.
- React function components with hooks; no class components.
- Follow the patterns already in the file you're editing (state shape,
  error handling, naming).
- New-UI components use the existing primitives in
  `src/interface/new/components/ui/` (Checkbox, Toggle, Dropdown, Tooltip…)
  and `reusables/` (OverlayScrollArea, ViewHeader, ScanButton…) instead of
  re-implementing them inline. If the shared component doesn't fit, extend it,
  don't fork it.
- ESLint config lives in `eslint.config.js`. Run `bun run lint` after edits.

### Rust

- `cargo fmt` style (run `cargo fmt` before committing).
- Errors are `Result<_, String>` for Tauri command boundaries, matching the
  existing convention in the file.
- Blocking work (git subprocesses, file IO) must run inside
  `tokio::task::spawn_blocking` so the UI thread never freezes. Most git
  commands in `git.rs` already follow this pattern, keep it that way.
- Add new Tauri commands to the `invoke_handler` list in `lib.rs`.

### Naming

- Frontend: `camelCase` for variables/functions, `PascalCase` for components,
  `kebab-case` for files (`InstalledVersionCard.tsx`, `useSettings.ts`).
- Rust: `snake_case` for functions/variables, `PascalCase` for types, files
  match the module they contain (`git_auth.rs`).
- Tauri command names are `snake_case` on the Rust side and are invoked from
  the frontend as camelCase args (`invoke('git_init_project', { path })`).

---

## 🌍 Localization (in depth)

Localization uses **i18next** + **react-i18next** with JSON resource files.
English is the source of truth; every other language falls back to English for
missing keys.

### How it's organized

```
src/i18n/
├── index.ts            # i18n setup: registers all locales & namespaces
├── languages.ts        # The language list shown in the UI + status badges
└── locales/
    ├── en-US/          # English, ALWAYS complete, the fallback
    │   ├── nav.json        #   Sidebar navigation labels
    │   ├── common.json     #   Shared strings (buttons, dialogs, modals)
    │   ├── settings.json   #   Settings view strings
    │   ├── git.json        #   Git sidebar & dialogs
    │   ├── changelog.json  #   Changelog view
    │   ├── onboarding.json #   Onboarding flow
    │   └── versions.json   #   Versions view
    ├── zh-CN/
    ├── ru-RU/
    └── ar-MA/
```

There are **7 namespaces** per language, each a JSON file: `nav`, `common`,
`settings`, `git`, `changelog`, `onboarding`, `versions`. Components pick a
namespace with `useTranslation('git')` or `useTranslation('common')`, etc.

### How strings are used in code

```tsx
// In a component:
const { t } = useTranslation('git')
const { t: tc } = useTranslation('common')   // different namespace alias

// Plain string:
<p>{t('pull_complete')}</p>

// With interpolation:
<p>{t('auth_connected_as', { username: 'ryko' })}</p>

// With a namespace override inline:
<p>{tc('cancel', { ns: 'common' })}</p>
```

Interpolation placeholders are written `{{name}}` in the JSON and passed as an
object to `t()`.

### Adding a new string (English only!)

1. Open the right namespace file under `src/i18n/locales/en-US/`
   (e.g. `common.json` for a button label).
2. Add your key:
   ```json
   "project_created": "Project created",
   "greeting_user": "Hello, {{name}}!"
   ```
3. Use it in the component with `t('project_created')`.
4. **Do not** add the key to other languages, they'll fall back to English.
5. Run `bunx tsc --noEmit` and `bun run lint`.

That's it, the new string shows up in every language automatically until a
translator covers it.

### Adding a new language (step by step)

Say you want to add **Japanese** (`ja-JP`):

1. **Create the locale folder** with all 7 namespace files, copied from English
   so the key structure is identical:
   ```bash
   mkdir src/i18n/locales/ja-JP
   cp src/i18n/locales/en-US/*.json src/i18n/locales/ja-JP/
   ```
2. **Translate** the values (not the keys!) in each file. Untranslated strings
   can be left in English, they fall back, but try to cover the common
   namespaces first (`common`, `nav`, `settings`).
3. **Register the resources** in `src/i18n/index.ts`:
   ```ts
   import jaJPNav from './locales/ja-JP/nav.json'
   // …one import per namespace…

   const jaJPResources = {
     nav: jaJPNav,
     common: jaJPCommon,
     settings: jaJPSettings,
     git: jaJPGit,
     changelog: jaJPChangelog,
     onboarding: jaJPOnboarding,
     versions: jaJPVersions,
   }

   const resources = {
     'en-US': { … },
     'ja-JP': jaJPResources,
     // …
   }
   ```
   If your language has a short code that should also match (like `zh` for
   `zh-CN`), add an alias: `ja: jaJPResources,`.
4. **Add it to the language picker** in `src/i18n/languages.ts`:
   ```ts
   export const LANGUAGES: LanguageOption[] = [
     { value: 'en-US', label: 'English', country: 'US', status: 'complete' },
     { value: 'ja-JP', label: '日本語', country: 'JP', status: 'incomplete' },
     // …
   ]
   ```
   The `value` must match the key in `resources` exactly, and `country` is the
   ISO 3166-1 alpha-2 code (upper-case) used for the flag icon shown before
   the label in every language picker. If the flag doesn't render, add a
   mapping in `src/interface/new/components/reusables/LanguageFlag.tsx`. The
   language picker (both classic and new UI) reads this array, so adding the
   entry here makes the language appear everywhere automatically.
5. **Set a status badge.** `status` is one of:
   - `complete`, every key translated and verified.
   - `beta`, mostly translated; minor gaps or needs a native-speaker review.
   - `incomplete`, new or partially translated; falls back to English in places.

   The badge text comes from `language_complete` / `language_beta` /
   `language_incomplete` in the `settings` namespace. Update the
   **Languages table in the README** to match.
6. **Run the checks** and open a PR. Native speakers are strongly preferred,
   if you're not fluent, get a review from a fluent speaker before marking a
   language `complete` or `beta`.

### Updating an existing translation

- Fix a wrong string: edit the value in that language's JSON file, same key.
- If the English source text changes, the old key stays; update the value and
  bump the translation so it still reads naturally.
- Translation status lives in `languages.ts`, if you complete a language,
  flip its status there and in the README table.

### Locale file checklist

- Keys are always `snake_case`, quoted, with commas after every entry except
  the last.
- Values keep `{{placeholder}}` interpolation tokens intact.
- Never reorder or rename keys in non-English files without updating the
  English source first.

---

## 🧪 Testing & CI

- **CI** (`.github/workflows/ci.yml`) runs on every push/PR to `main` on
  **Windows, Ubuntu, and macOS**:
  1. TypeScript typecheck (`tsc --noEmit`)
  2. Rust `cargo check`
  3. Vite production build
- There's no unit-test suite yet, verification is typecheck + lint + manual
  testing. If you add a Rust module with non-trivial logic, `#[cfg(test)]`
  unit tests are very welcome.
- **Manual testing matters.** Before opening a PR, exercise the feature you
  touched: create/open projects, install a version, push/pull in the Git
  sidebar, switch themes. Mention what you tested and on which OS.

---

## 🚀 Release Process

Releases are cut by maintainers from `main` using the `release.yml` workflow
(builds installers for all platforms, publishes to GitHub Releases and
winget). You don't need to do anything special as a contributor, just get
your PR merged.

---

## ❓ Getting Help

- **Issues**, ask questions in an issue or a PR discussion. The maintainer
  is active and friendly.
- **Feature ideas / QoL suggestions**, issues are welcome; the project loves
  QoL improvements.
- **Translations**, if you want to start a new language, open an issue first
  so the team can add you and track it.

Thanks again for contributing, happy building! 🚀
