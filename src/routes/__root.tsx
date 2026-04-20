import { Outlet, createRootRoute } from '@tanstack/react-router'

import { TwitterWidgetsScript } from '@/components/media/TwitterWidgetsScript'
import { ThemeRuntimeBridge } from '@/features/theme/runtime'

function RootComponent() {
  return (
    <>
      <ThemeRuntimeBridge />
      <TwitterWidgetsScript />
      <Outlet />
    </>
  )
}

export const rootRoute = createRootRoute({
  component: RootComponent,
})
