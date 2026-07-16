import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import type { ComponentType } from "react"

import { parseWallSearch, stringifyWallSearch, validateWallSearch } from "./search-state"

export interface GreenfieldRouterContext {
  queryClient: QueryClient
}

export interface CreateGreenfieldRouterOptions {
  queryClient: QueryClient
  appComponent: ComponentType
  history?: RouterHistory
}

function EmptyRoute() {
  return null
}

/**
 * Build the two-route SPA without importing the application shell. The shell is
 * rendered once at the root and may inspect `/media/$mediaId` to layer the
 * addressable lightbox over its still-mounted wall.
 */
export function createGreenfieldRouter(options: CreateGreenfieldRouterOptions) {
  const AppComponent = options.appComponent

  function RootComponent() {
    return (
      <>
        <AppComponent />
        <Outlet />
      </>
    )
  }

  const rootRoute = createRootRouteWithContext<GreenfieldRouterContext>()({
    validateSearch: validateWallSearch,
    component: RootComponent,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: EmptyRoute,
  })
  const mediaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/media/$mediaId",
    component: EmptyRoute,
  })
  const routeTree = rootRoute.addChildren([indexRoute, mediaRoute])

  return createRouter({
    routeTree,
    context: { queryClient: options.queryClient },
    history: options.history,
    parseSearch: parseWallSearch,
    stringifySearch: stringifyWallSearch,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    scrollRestoration: true,
  })
}

export type GreenfieldRouter = ReturnType<typeof createGreenfieldRouter>

