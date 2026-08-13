import type { CommittedWallState, FacetSelection } from "../contracts/domain"

export interface DiscoveryRequestIdentity {
  q: string
  filters: FacetSelection[]
  sort: CommittedWallState["sort"]
  seed?: string
  similar?: string
}

function canonicalFilters(filters: FacetSelection[]): FacetSelection[] {
  return filters
    .filter((filter) => filter.id && filter.values.length > 0)
    .map((filter) => ({
      id: filter.id,
      values: [...new Set(filter.values)].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Backend identity deliberately excludes mode and density. Seed only affects
 * backend identity for the random sort; otherwise it remains composition-only.
 */
export function discoveryRequestIdentity(
  state: CommittedWallState,
): DiscoveryRequestIdentity {
  return {
    q: state.q.trim().replace(/\s+/g, " "),
    filters: canonicalFilters(state.filters),
    sort: state.sort,
    ...(state.sort === "random" ? { seed: state.seed } : {}),
    ...(state.similar ? { similar: state.similar } : {}),
  }
}

export const discoveryKeys = {
  all: ["greenfield", "discovery"] as const,
  pages: (state: CommittedWallState) =>
    [...discoveryKeys.all, "pages", discoveryRequestIdentity(state)] as const,
  count: (state: CommittedWallState) =>
    [...discoveryKeys.all, "count", discoveryRequestIdentity(state)] as const,
  media: (mediaId: string) => ["greenfield", "media", mediaId] as const,
}
