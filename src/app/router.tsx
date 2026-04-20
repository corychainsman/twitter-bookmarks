import { createRouter } from '@tanstack/react-router'

import { indexRoute } from '@/routes/index'
import { rootRoute } from '@/routes/__root'
import { themesRoute } from '@/routes/themes'

const routeTree = rootRoute.addChildren([
  indexRoute,
  themesRoute,
])
const basepath =
  import.meta.env.BASE_URL === '/'
    ? '/'
    : import.meta.env.BASE_URL.replace(/\/+$/, '')

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  basepath,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
