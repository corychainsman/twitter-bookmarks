import type {
  CommittedWallState,
  Density,
  FacetSelection,
  SortMode,
  ViewMode,
} from "../contracts/domain"
import { createCompositionSeed, validateWallSearch } from "./search-state"

export type WallMutation =
  | { type: "search"; q: string }
  | { type: "filters"; filters: FacetSelection[] }
  | { type: "adopt-broader-filters"; filters: FacetSelection[] }
  | { type: "sort"; sort: SortMode }
  | { type: "mode"; mode: ViewMode }
  | { type: "shuffle"; seed?: string }
  | { type: "density"; density: Density }
  | { type: "density-fallback" }
  | { type: "similar"; mediaId?: string }

export interface WallNavigationPlan {
  search: CommittedWallState
  history: "push" | "replace"
  landing: "top" | "preserve-anchor"
}

/**
 * Centralizes the agreed browser-history policy so controls do not each invent
 * their own push/replace and scroll behavior.
 */
export function planWallNavigation(
  current: CommittedWallState,
  mutation: WallMutation,
): WallNavigationPlan {
  let patch: Partial<CommittedWallState>
  let history: WallNavigationPlan["history"] = "push"
  let landing: WallNavigationPlan["landing"] = "top"

  switch (mutation.type) {
    case "search":
      patch = { q: mutation.q }
      break
    case "filters":
    case "adopt-broader-filters":
      patch = { filters: mutation.filters }
      break
    case "sort":
      patch = { sort: mutation.sort }
      break
    case "similar":
      patch = { similar: mutation.mediaId }
      break
    case "shuffle":
      patch = { seed: mutation.seed ?? createCompositionSeed() }
      break
    case "mode":
      patch = { mode: mutation.mode }
      landing = "preserve-anchor"
      break
    case "density":
      patch = { density: mutation.density }
      landing = "preserve-anchor"
      break
    case "density-fallback":
      patch = { density: "auto" }
      history = "replace"
      landing = "preserve-anchor"
      break
  }

  return {
    search: validateWallSearch({ ...current, ...patch }),
    history,
    landing,
  }
}

export const lightboxHistory = {
  open: { history: "push" as const },
  navigate: { history: "replace" as const },
  close: { history: "back" as const },
}
