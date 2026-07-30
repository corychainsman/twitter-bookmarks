import type { Density, MediaKind, SortMode, ViewMode } from "../../contracts/domain"

export interface FilterToken {
  id: string
  label: string
}

export type DatePreset = "any" | "week" | "month" | "year" | "custom"

export interface DateFilterValue {
  preset: DatePreset
  from?: string
  to?: string
}

export interface ControlFilterValues {
  mediaKinds: MediaKind[]
  sources: FilterToken[]
  widthRange: readonly [number, number]
  date: DateFilterValue
}

export interface FilterRangeConfig {
  min: number
  max: number
  step: number
  unit: string
}

export interface SourceSuggestion extends FilterToken {
  count?: number
}

export interface FilterControlProps {
  value: ControlFilterValues
  range: FilterRangeConfig
  sourceSuggestions: SourceSuggestion[]
  sourceQuery: string
  sourceSearching?: boolean
  onChange: (value: ControlFilterValues) => void
  onSourceQueryChange: (query: string) => void
}

export interface SortOption {
  value: SortMode
  label: string
}

export interface DensityControlValue {
  value: Density
  effectiveValue: number
  min: number
  max: number
  step: number
}

export interface WallControlProps {
  searchDraft: string
  searchPlaceholder?: string
  resultPending?: boolean
  filters: ControlFilterValues
  filterRange: FilterRangeConfig
  selectedFilterCount?: number
  sourceSuggestions: SourceSuggestion[]
  sourceQuery: string
  sourceSearching?: boolean
  mobileDraftResultCount?: number
  mobileDraftCountPending?: boolean
  filterRailOpen: boolean
  mobileFiltersOpen: boolean
  mode: ViewMode
  sort: SortMode
  sortOptions: SortOption[]
  density: DensityControlValue
  shufflePending?: boolean
  onSearchDraftChange: (draft: string) => void
  onSearchSubmit: (query: string) => void
  onDesktopFiltersChange: (filters: ControlFilterValues) => void
  onMobileFilterDraftChange?: (filters: ControlFilterValues) => void
  onFiltersCommit: (filters: ControlFilterValues) => void
  onSourceQueryChange: (query: string) => void
  onFilterRailOpenChange: (open: boolean) => void
  onMobileFiltersOpenChange: (open: boolean) => void
  onModeChange: (mode: ViewMode) => void
  onSortChange: (sort: SortMode) => void
  onDensityDraft: (density: number) => void
  onDensityCommit: (density: number) => void
  onDensityAuto: () => void
  onShuffle: () => void
}

export function cloneFilterValues(value: ControlFilterValues): ControlFilterValues {
  return {
    mediaKinds: [...value.mediaKinds],
    sources: value.sources.map((source) => ({ ...source })),
    widthRange: [value.widthRange[0], value.widthRange[1]],
    date: { ...value.date },
  }
}

export function countSelectedFilters(
  value: ControlFilterValues,
  range: FilterRangeConfig,
): number {
  const widthIsFiltered =
    value.widthRange[0] !== range.min || value.widthRange[1] !== range.max
  const dateIsFiltered = value.date.preset !== "any"

  return (
    value.mediaKinds.length +
    value.sources.length +
    Number(widthIsFiltered) +
    Number(dateIsFiltered)
  )
}
