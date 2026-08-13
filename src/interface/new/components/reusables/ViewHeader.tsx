import type { ReactNode } from 'react'

export function ViewHeader({
  title,
  leadingAction,
  metric,
  actions,
  children,
  className = '',
}: {
  title: ReactNode
  leadingAction?: ReactNode
  metric?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={`shrink-0 rounded-card bg-raised px-6 py-4 flex flex-col gap-2 ${className}`}
    >
      <header className="shrink-0 flex flex-row items-center gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="font-display text-4xl font-bold tracking-wide text-ink uppercase">
            {title}
          </h1>
          {leadingAction}
        </div>

        {metric && (
          <div className="ml-auto flex items-baseline gap-1">{metric}</div>
        )}

        {actions && (
          <div className={`flex items-center gap-2 ${metric ? '' : 'ml-auto'}`}>
            {actions}
          </div>
        )}
      </header>

      {children}
    </section>
  )
}
