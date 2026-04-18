import { createRoute } from '@tanstack/react-router'

import { ThemeStudio } from '@/app/ThemeStudio'
import { rootRoute } from '@/routes/__root'

export const themesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/themes',
  component: ThemeStudio,
})
