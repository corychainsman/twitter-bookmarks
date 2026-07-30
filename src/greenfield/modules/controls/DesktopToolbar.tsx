import { cn } from "@/lib/utils"

import type { WallControlProps } from "./types"
import { DensityControl } from "./DensityControl"
import { FilterButton } from "./FilterButton"
import { ModeControl } from "./ModeControl"
import { SearchControl } from "./SearchControl"
import { ShuffleButton } from "./ShuffleButton"
import { SortControl } from "./SortControl"

interface DesktopToolbarProps extends WallControlProps {
  filterCount: number
  className?: string
}

export function DesktopToolbar({
  searchDraft,
  searchPlaceholder,
  resultPending = false,
  filterRailOpen,
  filterCount,
  mode,
  sort,
  sortOptions,
  density,
  shufflePending,
  onSearchDraftChange,
  onSearchSubmit,
  onFilterRailOpenChange,
  onModeChange,
  onSortChange,
  onDensityDraft,
  onDensityCommit,
  onDensityAuto,
  onShuffle,
  className,
}: DesktopToolbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 hidden h-14 items-center gap-3 border-b border-border/70 bg-background/92 px-4 supports-backdrop-filter:backdrop-blur-xl lg:flex",
        className,
      )}
    >
      <SearchControl
        value={searchDraft}
        placeholder={searchPlaceholder}
        pending={false}
        compact
        onChange={onSearchDraftChange}
        onSubmit={onSearchSubmit}
        className="min-w-48 max-w-xl flex-1"
      />
      <div role="group" aria-label="Wall controls" className="flex shrink-0 items-center gap-2">
        <FilterButton
          open={filterRailOpen}
          count={filterCount}
          controlsId="desktop-wall-filters"
          pending={resultPending}
          onClick={() => onFilterRailOpenChange(!filterRailOpen)}
        />
        <SortControl value={sort} options={sortOptions} onChange={onSortChange} />
        <ModeControl value={mode} onChange={onModeChange} />
        <DensityControl
          density={density}
          onDraft={onDensityDraft}
          onCommit={onDensityCommit}
          onAuto={onDensityAuto}
        />
        <ShuffleButton pending={shufflePending} onClick={onShuffle} />
      </div>
    </header>
  )
}
