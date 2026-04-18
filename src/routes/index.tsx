import { createRoute } from '@tanstack/react-router'

import { AppShell } from '@/app/AppShell'
import { rootRoute } from '@/routes/__root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AppShell,
})
