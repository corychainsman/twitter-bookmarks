import * as React from "react"

import { cn } from "@/lib/utils"

import { DesktopToolbar } from "../modules/controls/DesktopToolbar"
import { MobileToolbar } from "../modules/controls/MobileToolbar"
import {
  countSelectedFilters,
  type WallControlProps,
} from "../modules/controls/types"
import { useMobileChromeVisibility } from "./useMobileChromeVisibility"

const MobileFilterDrawer = React.lazy(() =>
  import("../modules/controls/MobileFilterDrawer").then((module) => ({
    default: module.MobileFilterDrawer,
  })),
)
const DesktopFilterRail = React.lazy(() =>
  import("../modules/controls/DesktopFilterRail").then((module) => ({
    default: module.DesktopFilterRail,
  })),
)

export interface MediaWallShellProps extends WallControlProps {
  children: React.ReactNode
  wallLabel?: string
  mobileChromePinned?: boolean
  onFilterRailLayoutCommit?: (open: boolean) => void
  className?: string
  wallClassName?: string
}

export function MediaWallShell({
  children,
  wallLabel = "Media results",
  mobileChromePinned = false,
  onFilterRailLayoutCommit,
  className,
  wallClassName,
  ...controls
}: MediaWallShellProps) {
  const [mobileFocusWithin, setMobileFocusWithin] = React.useState(false)
  const [mobileSurfaceOpen, setMobileSurfaceOpen] = React.useState(false)
  const [mobileDrawerActivated, setMobileDrawerActivated] = React.useState(
    controls.mobileFiltersOpen,
  )
  const [desktopRailActivated, setDesktopRailActivated] = React.useState(
    controls.filterRailOpen,
  )
  const filterCount =
    controls.selectedFilterCount ??
    countSelectedFilters(controls.filters, controls.filterRange)
  const mobileChromeVisible = useMobileChromeVisibility({
    pinned:
      mobileChromePinned ||
      mobileFocusWithin ||
      mobileSurfaceOpen ||
      controls.mobileFiltersOpen,
  })

  return (
    <div
      className={cn(
        "scheme-only-dark isolate min-h-dvh bg-background text-foreground antialiased",
        className,
      )}
    >
      <DesktopToolbar
        {...controls}
        filterCount={filterCount}
        onFilterRailOpenChange={(open) => {
          if (open) setDesktopRailActivated(true)
          controls.onFilterRailOpenChange(open)
        }}
      />
      <div
        onFocusCapture={() => setMobileFocusWithin(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setMobileFocusWithin(false)
          }
        }}
      >
        <MobileToolbar
          {...controls}
          filterCount={filterCount}
          visible={mobileChromeVisible}
          onMobileFiltersOpenChange={(open) => {
            if (open) setMobileDrawerActivated(true)
            controls.onMobileFiltersOpenChange(open)
          }}
          onTransientInteractionChange={setMobileSurfaceOpen}
        />
      </div>

      <div className="relative flex min-w-0 items-start">
        {(desktopRailActivated || controls.filterRailOpen) && (
          <React.Suspense fallback={null}>
            <DesktopFilterRail
              open={controls.filterRailOpen}
              value={controls.filters}
              range={controls.filterRange}
              sourceSuggestions={controls.sourceSuggestions}
              sourceQuery={controls.sourceQuery}
              sourceSearching={controls.sourceSearching}
              onChange={controls.onDesktopFiltersChange}
              onSourceQueryChange={controls.onSourceQueryChange}
              onOpenChange={controls.onFilterRailOpenChange}
              onLayoutCommit={onFilterRailLayoutCommit}
            />
          </React.Suspense>
        )}
        <main
          aria-label={wallLabel}
          aria-busy={controls.resultPending || undefined}
          className={cn("min-w-0 flex-1", wallClassName)}
        >
          <h1 className="sr-only">X Inspo</h1>
          {children}
        </main>
      </div>

      {(mobileDrawerActivated || controls.mobileFiltersOpen) && (
        <React.Suspense fallback={null}>
          <MobileFilterDrawer
            open={controls.mobileFiltersOpen}
            value={controls.filters}
            range={controls.filterRange}
            resultCount={controls.mobileDraftResultCount}
            countPending={controls.mobileDraftCountPending}
            sourceSuggestions={controls.sourceSuggestions}
            sourceQuery={controls.sourceQuery}
            sourceSearching={controls.sourceSearching}
            onSourceQueryChange={controls.onSourceQueryChange}
            onOpenChange={controls.onMobileFiltersOpenChange}
            onDraftChange={controls.onMobileFilterDraftChange}
            onCommit={controls.onFiltersCommit}
          />
        </React.Suspense>
      )}
    </div>
  )
}
