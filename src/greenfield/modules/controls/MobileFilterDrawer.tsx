import * as React from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

import { FilterPanel } from "./FilterPanel"
import {
  cloneFilterValues,
  type ControlFilterValues,
  type FilterControlProps,
} from "./types"

interface MobileFilterDrawerProps
  extends Omit<FilterControlProps, "value" | "onChange"> {
  open: boolean
  value: ControlFilterValues
  resultCount?: number
  countPending?: boolean
  onOpenChange: (open: boolean) => void
  onDraftChange?: (value: ControlFilterValues) => void
  onCommit: (value: ControlFilterValues) => void
}

const MOBILE_FILTER_SNAP_POINTS: (number | string)[] = [0.66, 1]

export function MobileFilterDrawer({
  open,
  value,
  resultCount,
  countPending = false,
  onOpenChange,
  onDraftChange,
  onCommit,
  ...filterProps
}: MobileFilterDrawerProps) {
  const [draft, setDraft] = React.useState(() => cloneFilterValues(value))
  const [activeSnapPoint, setActiveSnapPoint] = React.useState<number | string | null>(1)
  const wasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      const nextDraft = cloneFilterValues(value)
      setDraft(nextDraft)
      onDraftChange?.(nextDraft)
    }
    if (!open && wasOpenRef.current) {
      setDraft(cloneFilterValues(value))
    }
    wasOpenRef.current = open
  }, [onDraftChange, open, value])

  function updateDraft(nextDraft: ControlFilterValues) {
    setDraft(nextDraft)
    onDraftChange?.(nextDraft)
  }

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setDraft(cloneFilterValues(value))
      setActiveSnapPoint(1)
      filterProps.onSourceQueryChange("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      snapPoints={MOBILE_FILTER_SNAP_POINTS}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={0}
      modal
    >
      <DrawerContent
        id="mobile-wall-filters"
        className="h-[92dvh] max-h-[92dvh] border-border bg-popover shadow-none"
      >
        <DrawerHeader className="shrink-0 border-b border-border/70 px-4 pt-3 pb-4 text-left">
          <DrawerTitle className="text-lg font-medium">Filters</DrawerTitle>
          <DrawerDescription
            className="text-base text-muted-foreground"
          >
            Changes take effect when you apply them.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 pb-8">
          <FilterPanel
            {...filterProps}
            value={draft}
            onChange={updateDraft}
            idPrefix="mobile-filters"
            rangeCommitMode="continuous"
          />
        </div>
        <DrawerFooter className="sticky bottom-0 shrink-0 border-t border-border/70 bg-popover p-4">
          <Button
            type="button"
            size="lg"
            disabled={countPending}
            onClick={() => {
              onCommit(cloneFilterValues(draft))
              setOpen(false)
            }}
            className="w-full tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {countPending ? (
              <>
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                />
                Updating count
              </>
            ) : resultCount === undefined ? (
              "Apply filters"
            ) : (
              `Show ${resultCount.toLocaleString()} results`
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
