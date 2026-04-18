import { createRouter } from '@tanstack/react-router'

import { indexRoute } from '@/routes/index'
import { rootRoute } from '@/routes/__root'
import { themesRoute } from '@/routes/themes'

const routeTree = rootRoute.addChildren([indexRoute, themesRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
