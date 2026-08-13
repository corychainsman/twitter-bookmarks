import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { FilterPanel } from "./FilterPanel"
import type { FilterControlProps } from "./types"

type RailPhase = "closed" | "opening" | "open" | "closing"

interface DesktopFilterRailProps extends FilterControlProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLayoutCommit?: (open: boolean) => void
  className?: string
}

export function DesktopFilterRail({
  open,
  onOpenChange,
  onLayoutCommit,
  className,
  ...filterProps
}: DesktopFilterRailProps) {
  const [settledOpen, setSettledOpen] = React.useState(open)
  const committedOpenRef = React.useRef(open)
  const phase: RailPhase = open
    ? settledOpen
      ? "open"
      : "opening"
    : settledOpen
      ? "closing"
      : "closed"

  React.useLayoutEffect(() => {
    if (phase === "closing" && committedOpenRef.current) {
      committedOpenRef.current = false
      onLayoutCommit?.(false)
    }
  }, [onLayoutCommit, phase])

  const settle = React.useCallback(() => {
    if (phase === "opening") {
      if (!committedOpenRef.current) {
        committedOpenRef.current = true
        onLayoutCommit?.(true)
      }
      setSettledOpen(true)
    }
    if (phase === "closing") setSettledOpen(false)
  }, [onLayoutCommit, phase])

  React.useEffect(() => {
    if (phase !== "opening" && phase !== "closing") return
    const timeout = window.setTimeout(settle, 220)
    return () => window.clearTimeout(timeout)
  }, [phase, settle])

  if (phase === "closed") return null

  const overlaying = phase === "opening" || phase === "closing"

  return (
    <aside
      id="desktop-wall-filters"
      aria-label="Filter results"
      data-phase={phase}
      onAnimationEnd={settle}
      className={cn(
        "z-30 hidden w-72 shrink-0 flex-col border-r border-border/70 bg-background lg:flex",
        overlaying
          ? "absolute inset-y-0 left-0"
          : "relative min-h-[calc(100dvh-3.5rem)]",
        phase === "opening" &&
          "motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-200",
        phase === "closing" &&
          "motion-safe:animate-out motion-safe:slide-out-to-left-full motion-safe:duration-200",
        className,
      )}
    >
      <div className="sticky top-14 flex max-h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 p-3 pl-4">
          <h2 className="text-base font-medium text-foreground sm:text-sm">Filters</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close filters"
            onClick={() => onOpenChange(false)}
            className="relative"
          >
            <X aria-hidden="true" className="size-4 shrink-0" />
            <span
              aria-hidden="true"
              className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
            />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <FilterPanel
            {...filterProps}
            idPrefix="desktop-filters"
            rangeCommitMode="release"
          />
        </div>
      </div>
    </aside>
  )
}
