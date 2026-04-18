import { Outlet, createRootRoute } from '@tanstack/react-router'

import { ThemeRuntimeBridge } from '@/features/theme/runtime'

function RootComponent() {
  return (
    <>
      <ThemeRuntimeBridge />
      <Outlet />
    </>
  )
}

export const rootRoute = createRootRoute({
  component: RootComponent,
})
