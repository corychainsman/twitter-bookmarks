import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query"
import { useState, type PropsWithChildren } from "react"

const DEFAULT_STALE_TIME = 30_000
const DEFAULT_GC_TIME = 15 * 60_000

export function createGreenfieldQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        retry: 1,
        refetchOnWindowFocus: false,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        retry: 0,
        ...config.defaultOptions?.mutations,
      },
    },
  })
}

export interface GreenfieldQueryProviderProps extends PropsWithChildren {
  client?: QueryClient
}

export function GreenfieldQueryProvider({
  children,
  client,
}: GreenfieldQueryProviderProps) {
  const [ownedClient] = useState(createGreenfieldQueryClient)

  return (
    <QueryClientProvider client={client ?? ownedClient}>{children}</QueryClientProvider>
  )
}

