import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tsParser from '@typescript-eslint/parser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const noClassicUiImports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid New UI files from importing classic UI code (src/interface/classic)',
    },
    messages: {
      forbidden:
        'New UI must not import classic UI from "{{source}}". Move shared components into src/interface/new/ instead.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/')
    if (!filename.includes('/src/interface/new/')) return {}

    const fileDir = path.dirname(context.filename ?? context.getFilename())
    const blockedDirs = [path.join(srcDir, 'interface', 'classic')]

    const isBlocked = (resolved) =>
      blockedDirs.some(
        (dir) => resolved === dir || resolved.startsWith(dir + path.sep),
      )

    const checkSource = (node, source) => {
      if (typeof source !== 'string' || !source.startsWith('.')) return
      const resolved = path.resolve(fileDir, source)
      if (isBlocked(resolved)) {
        context.report({ node, messageId: 'forbidden', data: { source } })
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node, node.source?.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSource(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source?.value)
      },
      ImportExpression(node) {
        if (node.source && typeof node.source.value === 'string') {
          checkSource(node, node.source.value)
        }
      },
    }
  },
}

export default [
  {
    ignores: [
      'src-tauri/target/**',
      'src-tauri/gen/**',
      'node_modules/**',
      'dist/**',
      'src-tauri/.tauri/**',
    ],
  },
  {
    files: ['src/interface/new/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      'godothub': {
        rules: { 'no-classic-ui-imports': noClassicUiImports },
      },
    },
    rules: {
      'godothub/no-classic-ui-imports': 'error',
    },
  },
]
