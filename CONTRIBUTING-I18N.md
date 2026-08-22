# Contributing Translations to GodotHub

Thank you for helping make GodotHub accessible to more people! This guide covers everything you need to know about adding or improving translations.

## Current Status

| Locale | Language | Status | Progress |
|--------|----------|--------|----------|
| `en-US` | English | ✅ Complete | Source of truth |
| `es-MX` | Español | 🚧 Incomplete | Needs work |
| `zh-CN` | 简体中文 | 🧪 Beta | Mostly done |
| `ru-RU` | Русский | 🚧 Incomplete | Needs work |
| `ar-MA` | العربية | 🚧 Incomplete | Needs work |

**Total keys:** ~1,316 across 8 namespaces

## Quick Start

### Adding a New Language

1. **Create the locale folder:**
   ```bash
   cp -r src/i18n/locales/en-US src/i18n/locales/xx-YY
   ```

2. **Add your language to the language list** in `src/i18n/languages.ts`:
   ```typescript
   { value: 'xx-YY', label: 'Your Language', country: 'YY', status: 'incomplete' },
   ```

3. **Register imports in `src/i18n/index.ts`:**
   ```typescript
   import xxYYNav from './locales/xx-YY/nav.json'
   import xxYYCommon from './locales/xx-YY/common.json'
   import xxYYSettings from './locales/xx-YY/settings.json'
   import xxYYGit from './locales/xx-YY/git.json'
   import xxYYChangelog from './locales/xx-YY/changelog.json'
   import xxYYOnboarding from './locales/xx-YY/onboarding.json'
   import xxYYVersions from './locales/xx-YY/versions.json'
   import xxYYDashboard from './locales/xx-YY/dashboard.json'
   ```

4. **Add to the resources object:**
   ```typescript
   const xxYYResources = {
     nav: xxYYNav,
     common: xxYYCommon,
     settings: xxYYSettings,
     git: xxYYGit,
     changelog: xxYYChangelog,
     onboarding: xxYYOnboarding,
     versions: xxYYVersions,
     dashboard: xxYYDashboard,
   }
   
   // In the resources object:
   'xx-YY': xxYYResources,
   xx: xxYYResources,  // optional shorthand
   ```

5. **Translate the values** in each JSON file (keep keys identical to en-US).

6. **Update the status** in `languages.ts` as you progress:
   - `incomplete` → less than 50% translated
   - `beta` → 50-90% translated
   - `complete` → 100% translated and reviewed

### Improving Existing Translations

1. Find your locale's files in `src/i18n/locales/xx-YY/`
2. Update the translated values (never change the keys)
3. Submit a PR with your changes

## File Structure

```
src/i18n/
├── index.ts              # i18n configuration
├── languages.ts          # Language options & status
├── types.ts              # Auto-generated TypeScript types
└── locales/
    ├── en-US/            # Source of truth
    │   ├── changelog.json
    │   ├── common.json
    │   ├── dashboard.json
    │   ├── git.json
    │   ├── nav.json
    │   ├── onboarding.json
    │   ├── settings.json
    │   └── versions.json
    ├── es-MX/
    ├── zh-CN/
    ├── ru-RU/
    └── ar-MA/
```

## Namespace Reference

| Namespace | Description | Keys |
|-----------|-------------|------|
| `common` | General UI strings, buttons, messages | ~768 |
| `settings` | Settings page labels & descriptions | ~314 |
| `git` | Git integration strings | ~146 |
| `versions` | Godot version management | ~46 |
| `onboarding` | First-run setup wizard | ~17 |
| `nav` | Navigation sidebar | ~11 |
| `changelog` | Changelog management | ~9 |
| `dashboard` | Dashboard greetings | ~5 |

## Adding New Translation Keys

When adding new UI features, you'll need to add keys to **all** locale files.

1. **Add to en-US first:**
   ```json
   // src/i18n/locales/en-US/common.json
   {
     "your_new_key": "Your new text"
   }
   ```

2. **Add to all other locales** (even if empty for now):
   ```json
   // src/i18n/locales/es-MX/common.json
   {
     "your_new_key": "Tu nuevo texto"
   }
   ```

3. **Regenerate TypeScript types:**
   ```bash
   node scripts/generate-i18n-types.cjs
   ```

## Interpolation & Pluralization

### Interpolation
Use `{{variable}}` for dynamic values:
```json
{
  "project_count": "{{count}} projects",
  "welcome_user": "Welcome, {{name}}!"
}
```

### Pluralization
i18next supports `_one` and `_other` suffixes:
```json
{
  "file_count_one": "{{count}} file",
  "file_count_other": "{{count}} files"
}
```

Usage in code:
```typescript
t('file_count', { count: 5 })  // "5 files"
t('file_count', { count: 1 })  // "1 file"
```

### Namespace Prefixes
If not using the default namespace, prefix with `namespace:key`:
```typescript
t('git:commit')           // git namespace
t('settings:theme')       // settings namespace
t('common:save')          // common namespace (default)
```

## Validation & Testing

### Check for Missing Keys
Compare your locale against en-US:
```bash
npm run i18n:check                  # Check all locales
npm run i18n:check -- zh-CN         # Check only your locale
npm run i18n:check -- zh-CN ru-RU   # Check multiple locales
npm run i18n:check -- --list        # List available locales
npm run i18n:check -- --missing     # Show only missing keys
```

This shows:
- ❌ Missing keys (in en-US but not in your locale)
- ⚠️ Extra keys (in your locale but not in en-US)
- 📊 Progress bar per namespace
- 💡 Next steps with copy-paste commands

#### Output Formats
```bash
npm run i18n:check -- --md          # Markdown table (for PRs)
npm run i18n:check -- --json        # JSON (for automation)
npm run i18n:check -- --md zh-CN    # Markdown for one locale
```

### Regenerate Types
After editing en-US files:
```bash
npm run i18n:types
```

### Type Checking
Run TypeScript to catch any issues:
```bash
npx tsc --noEmit
```

## Best Practices

### Do's ✅
- **Keep keys identical** across all locales — only change values
- **Use interpolation** for dynamic content: `{{name}}`, `{{count}}`
- **Test your translations** in the app if possible
- **Maintain the same tone** as the English version
- **Use proper formatting** for dates/numbers per locale
- **Keep translations concise** — UI space is limited

### Don'ts ❌
- **Don't translate keys** — only translate values
- **Don't add HTML** in translations (use interpolation instead)
- **Don't change interpolation variables** — keep `{{name}}` as-is
- **Don't translate technical terms** that should stay in English (e.g., "Git", "Godot")
- **Don't remove keys** that exist in en-US

### Translation Tips
- **UI labels:** Keep short and clear
- **Error messages:** Be helpful and specific
- **Tooltips:** Explain what the feature does
- **Placeholders:** Use natural phrasing for your language
- **Formal vs informal:** Match the existing tone (GodotHub uses informal)

## Handling RTL (Right-to-Left) Languages

For languages like Arabic, Hebrew, etc.:

1. The UI already supports RTL layout via CSS
2. No special code changes needed
3. Test that the interface mirrors correctly
4. Pay attention to mixed LTR/RTL content (e.g., "Git branch main")

## Questions?

If you have questions about translating a specific term or need help with your locale, open a discussion in the GitHub repository or comment on your PR.
