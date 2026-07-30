import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query"
import { useEffect } from "react"

import type { CommittedWallState } from "../contracts/domain"
import type { ApiTransport } from "../contracts/interfaces"
import { discoveryKeys } from "./query-keys"
import { useApiTransport } from "./transport-context"
import { subscribeToSemanticReadiness } from "../semantic/query-client"

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
  const transport = useApiTransport()
  const query = useInfiniteQuery(discoveryInfiniteOptions(transport, state))
  const refetch = query.refetch

  useEffect(() => {
    if (!state.q.trim()) return
    return subscribeToSemanticReadiness(() => {
      void refetch()
    })
  }, [refetch, state.q])

  return query
}

export function useResultCount(state: CommittedWallState) {
  const transport = useApiTransport()
  const query = useQuery(resultCountOptions(transport, state))
  const refetch = query.refetch

  useEffect(() => {
    if (!state.q.trim()) return
    return subscribeToSemanticReadiness(() => {
      void refetch()
    })
  }, [refetch, state.q])

  return query
}

export function useMedia(mediaId: string) {
  return useQuery(mediaOptions(useApiTransport(), mediaId))
}

export function useSourceSuggestions(query: string) {
  return useQuery(sourceSuggestionsOptions(useApiTransport(), query))
}
