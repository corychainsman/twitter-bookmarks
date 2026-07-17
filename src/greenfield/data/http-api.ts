import createClient from "openapi-fetch"

import type { CommittedWallState, FacetSelection } from "../contracts/domain"
import type { ApiTransport, SourceSuggestion } from "../contracts/interfaces"
import type { paths } from "../generated/api"
import { discoveryRequestIdentity } from "./query-keys"

const client = createClient<paths>({ baseUrl: "/api" })

function filterTokens(filters: FacetSelection[]): string[] {
  return filters.flatMap((filter) =>
    filter.values.map((value) => `${filter.id}:${value}`),
  )
}

function requestQuery(state: CommittedWallState) {
  const identity = discoveryRequestIdentity(state)

  return {
    q: identity.q,
    sort: identity.sort,
    filter: filterTokens(identity.filters),
    ...(identity.similar ? { similar: identity.similar } : {}),
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
            ...requestQuery(state),
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
        params: { query: requestQuery(state) },
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
