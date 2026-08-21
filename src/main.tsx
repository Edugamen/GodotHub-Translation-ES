import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './interface/classic/App'
import { ErrorBoundary } from './ErrorBoundary'
import { SettingsProvider } from './hooks/useSettings'
import { WorkspacesProvider } from './hooks/useWorkspaces'
import { ProjectsProvider } from './hooks/projectsContext'
import { CategoriesProvider } from './hooks/categoriesContext'
import { UpdatesBadgeProvider } from './hooks/useUpdatesBadge'
import { UpdateAvailableProvider } from './hooks/useUpdateAvailable'
import './i18n'
import { initReducedMotionDetection } from './lib/appearance'

initReducedMotionDetection()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WorkspacesProvider>
        <SettingsProvider>
          <ProjectsProvider>
            <CategoriesProvider>
              <UpdatesBadgeProvider>
                <UpdateAvailableProvider>
                  <App />
                </UpdateAvailableProvider>
              </UpdatesBadgeProvider>
            </CategoriesProvider>
          </ProjectsProvider>
        </SettingsProvider>
      </WorkspacesProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
