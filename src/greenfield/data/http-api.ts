import createClient from "openapi-fetch"

import type { CommittedWallState, FacetSelection } from "../contracts/domain"
import type { ApiTransport, SourceSuggestion } from "../contracts/interfaces"
import type { paths } from "../generated/api"
import { discoveryRequestIdentity } from "./query-keys"
import { encodeSemanticQuery } from "../semantic/query-client"

const client = createClient<paths>({ baseUrl: "/api" })

function filterTokens(filters: FacetSelection[]): string[] {
  return filters.flatMap((filter) =>
    filter.values.map((value) => `${filter.id}:${value}`),
  )
}

async function requestQuery(state: CommittedWallState, signal?: AbortSignal) {
  const identity = discoveryRequestIdentity(state)
  const semantic = await encodeSemanticQuery(identity.q, signal)

  return {
    q: identity.q,
    sort: identity.sort,
    ...(identity.seed ? { seed: identity.seed } : {}),
    filter: filterTokens(identity.filters),
    ...(identity.similar ? { similar: identity.similar } : {}),
    ...semantic,
  }
}

function apiError(operation: string, response: Response, error: unknown): Error {
  const message = typeof error === "object" && error && "message" in error
    ? String(error.message)
    : `${response.status} ${response.statusText}`
  return new Error(`${operation} failed: ${message}`)
}

export function createHttpApiTransport(): ApiTransport {
  return {
    async discover(state, cursor, signal) {
      const { data, error, response } = await client.GET("/discovery", {
        params: {
          query: {
            ...await requestQuery(state, signal),
            ...(cursor ? { cursor } : {}),
          },
        },
        signal,
      })

      if (!data) throw apiError("Discovery", response, error)
      return data
    },

    async count(state, signal) {
      const { data, error, response } = await client.GET("/discovery/count", {
        params: { query: await requestQuery(state, signal) },
        signal,
      })

      if (!data) throw apiError("Discovery count", response, error)
      return data
    },

    async media(mediaId, signal) {
      const { data, error, response } = await client.GET("/media/{mediaId}", {
        params: { path: { mediaId } },
        signal,
      })

      if (!data) throw apiError("Media lookup", response, error)
      return data
    },

    async suggestSources(query, signal): Promise<SourceSuggestion[]> {
      const { data, error, response } = await client.GET("/facets/{facetId}/values", {
        params: {
          path: { facetId: "source" },
          query: { q: query },
        },
        signal,
      })

      if (!data) throw apiError("Source suggestions", response, error)
      return data.values
    },
  }
}

export const httpApiTransport = createHttpApiTransport()
