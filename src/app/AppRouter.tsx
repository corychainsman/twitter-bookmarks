import * as React from 'react'

import { AppShell } from '@/app/AppShell'
import { resolveAppRoute, type AppRoute } from '@/app/app-route'
import { ThemeRuntimeBridge } from '@/features/theme/runtime'

const ThemeStudio = React.lazy(() =>
  import('@/app/ThemeStudio').then((module) => ({ default: module.ThemeStudio })),
)

function readCurrentRoute(): AppRoute {
  return resolveAppRoute(window.location.pathname, import.meta.env.BASE_URL)
}

export function AppRouter() {
  const [route, setRoute] = React.useState(readCurrentRoute)

  React.useEffect(() => {
    const handlePopState = () => setRoute(readCurrentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <>
      <ThemeRuntimeBridge />
      {route === 'themes' ? (
        <React.Suspense fallback={null}>
          <ThemeStudio />
        </React.Suspense>
      ) : (
        <AppShell />
      )}
    </>
  )
}
