import { createContext, createElement, useContext, type ReactNode } from 'react'

/**
 * Creates a context provider and consumer hook from a custom hook.
 * Eliminates the repetitive createContext / Provider / useXxxContext pattern.
 *
 * @param useHook - The hook that provides the context value.
 * @param name    - Display name for error messages (e.g. 'ProjectsProvider').
 */
export function createContextProvider<T>(useHook: () => T, name: string) {
  const Ctx = createContext<T | null>(null)
  Ctx.displayName = name

  function Provider({ children }: { children: ReactNode }) {
    const value = useHook()
    return createElement(Ctx.Provider, { value }, children)
  }
  Provider.displayName = `${name}.Provider`

  function useCtx() {
    const ctx = useContext(Ctx)
    if (!ctx) {
      throw new Error(`use${name}() must be used within a <${name}>`)
    }
    return ctx
  }
  useCtx.displayName = `use${name}`

  return { Provider, useCtx } as const
}
