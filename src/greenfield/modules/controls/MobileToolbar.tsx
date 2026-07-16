import * as React from "react"
import { GalleryVerticalEnd } from "lucide-react"

import { cn } from "@/lib/utils"

import type { WallControlProps } from "./types"
import { DensityControl } from "./DensityControl"
import { FilterButton } from "./FilterButton"
import { ModeControl } from "./ModeControl"
import { SearchControl } from "./SearchControl"
import { ShuffleButton } from "./ShuffleButton"
import { SortControl } from "./SortControl"

interface MobileToolbarProps extends WallControlProps {
  filterCount: number
  visible: boolean
  onTransientInteractionChange?: (active: boolean) => void
  className?: string
}

export function MobileToolbar({
  brandName,
  searchDraft,
  searchPlaceholder,
  resultPending = false,
  mobileFiltersOpen,
  filterCount,
  mode,
  sort,
  sortOptions,
  density,
  shufflePending,
  onSearchDraftChange,
  onSearchSubmit,
  onMobileFiltersOpenChange,
  onModeChange,
  onSortChange,
  onDensityDraft,
  onDensityCommit,
  onDensityAuto,
  onShuffle,
  visible,
  onTransientInteractionChange,
  className,
}: MobileToolbarProps) {
  const openSurfaces = React.useRef(new Set<string>())

  function setSurfaceOpen(surface: string, open: boolean) {
    if (open) openSurfaces.current.add(surface)
    else openSurfaces.current.delete(surface)
    onTransientInteractionChange?.(openSurfaces.current.size > 0)
  }

  return (
    <header
      data-visible={visible}
      className={cn(
        "sticky top-0 z-40 flex flex-col border-b border-border/70 bg-background/94 supports-backdrop-filter:backdrop-blur-xl data-[visible=false]:-translate-y-full motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none lg:hidden",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 p-2">
        <a
          href="/"
          aria-label="Homepage"
          title={brandName}
          className="relative grid size-11 shrink-0 place-items-center rounded-lg text-foreground outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <GalleryVerticalEnd
            aria-hidden="true"
            className="size-4 shrink-0 stroke-foreground"
          />
          <span className="sr-only">{brandName}</span>
          <span
            aria-hidden="true"
            className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
          />
        </a>
        <SearchControl
          value={searchDraft}
          placeholder={searchPlaceholder}
          pending={false}
          onChange={onSearchDraftChange}
          onSubmit={onSearchSubmit}
          className="min-w-0 flex-1"
        />
      </div>
      <div
        role="group"
        aria-label="Wall controls"
        className="flex min-w-0 items-center gap-2 overflow-x-auto border-t border-border/50 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterButton
          open={mobileFiltersOpen}
          count={filterCount}
          controlsId="mobile-wall-filters"
          pending={resultPending}
          onClick={() => onMobileFiltersOpenChange(!mobileFiltersOpen)}
          className="h-11 shrink-0"
        />
        <SortControl
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          onOpenChange={(open) => setSurfaceOpen("sort", open)}
          className="h-11 shrink-0"
        />
        <ModeControl
          value={mode}
          onChange={onModeChange}
          compact
          onOpenChange={(open) => setSurfaceOpen("mode", open)}
        />
        <DensityControl
          density={density}
          compact
          onDraft={onDensityDraft}
          onCommit={onDensityCommit}
          onAuto={onDensityAuto}
          onOpenChange={(open) => setSurfaceOpen("density", open)}
        />
        <ShuffleButton
          pending={shufflePending}
          compact
          onClick={onShuffle}
        />
      </div>
    </header>
  )
}
