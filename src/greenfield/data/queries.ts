import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query"

import type { CommittedWallState } from "../contracts/domain"
import type { ApiTransport } from "../contracts/interfaces"
import { discoveryKeys } from "./query-keys"
import { useApiTransport } from "./transport-context"

export function discoveryInfiniteOptions(
  transport: ApiTransport,
  state: CommittedWallState,
) {
  return infiniteQueryOptions({
    queryKey: discoveryKeys.pages(state),
    queryFn: ({ pageParam, signal }) => transport.discover(state, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.previousCursor,
    placeholderData: keepPreviousData,
  })
}

export function resultCountOptions(transport: ApiTransport, state: CommittedWallState) {
  return queryOptions({
    queryKey: discoveryKeys.count(state),
    queryFn: ({ signal }) => transport.count(state, signal),
    placeholderData: keepPreviousData,
  })
}

export function mediaOptions(transport: ApiTransport, mediaId: string) {
  return queryOptions({
    queryKey: discoveryKeys.media(mediaId),
    queryFn: ({ signal }) => transport.media(mediaId, signal),
    staleTime: 10 * 60_000,
  })
}

export function sourceSuggestionsOptions(transport: ApiTransport, query: string) {
  return queryOptions({
    queryKey: [...discoveryKeys.all, "sources", query.trim().toLocaleLowerCase()],
    queryFn: ({ signal }) => transport.suggestSources(query, signal),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60_000,
  })
}

export function useDiscovery(state: CommittedWallState) {
  return useInfiniteQuery(discoveryInfiniteOptions(useApiTransport(), state))
}

export function useResultCount(state: CommittedWallState) {
  return useQuery(resultCountOptions(useApiTransport(), state))
}

export function useMedia(mediaId: string) {
  return useQuery(mediaOptions(useApiTransport(), mediaId))
}

export function useSourceSuggestions(query: string) {
  return useQuery(sourceSuggestionsOptions(useApiTransport(), query))
}
