import { SlidersHorizontal, ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"

import { TouchTarget } from "./TouchTarget"
import type { DensityControlValue } from "./types"

interface DensityControlProps {
  density: DensityControlValue
  compact?: boolean
  onDraft: (value: number) => void
  onCommit: (value: number) => void
  onAuto: () => void
  onOpenChange?: (open: boolean) => void
}

function DensitySlider({ density, onDraft, onCommit, onAuto }: DensityControlProps) {
  const isAuto = density.value === "auto"
  const shownValue =
    typeof density.value === "number" ? density.value : density.effectiveValue

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ZoomOut aria-hidden="true" className="size-4 shrink-0 stroke-muted-foreground" />
      <Slider
        name="wall-density"
        aria-label="Wall density"
        min={density.min}
        max={density.max}
        step={density.step}
        value={[shownValue]}
        onValueChange={(next) => {
          const draft = next[0]
          if (draft !== undefined) onDraft(draft)
        }}
        onValueCommit={(next) => {
          const committed = next[0]
          if (committed !== undefined) onCommit(committed)
        }}
        className="min-h-8 min-w-24 flex-1 [&_[data-slot=slider-thumb]]:after:-inset-5"
      />
      <ZoomIn aria-hidden="true" className="size-4 shrink-0 stroke-muted-foreground" />
      <Button
        type="button"
        size="sm"
        variant={isAuto ? "secondary" : "ghost"}
        aria-pressed={isAuto}
        onClick={onAuto}
        className="relative tabular-nums"
      >
        Auto
        <TouchTarget />
      </Button>
    </div>
  )
}

export function DensityControl(props: DensityControlProps) {
  if (props.compact) {
    return (
      <Popover onOpenChange={props.onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Adjust wall density"
            className="relative"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" />
            <TouchTarget />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-foreground">Wall density</p>
              <p className="tabular-nums text-muted-foreground">
                {typeof props.density.value === "number"
                  ? `${Math.round(props.density.value * 100)}%`
                  : "Auto"}
              </p>
            </div>
            <DensitySlider {...props} />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="flex min-w-44 max-w-64 flex-1 items-center gap-3">
      <p className="shrink-0 text-sm font-medium text-muted-foreground">Density</p>
      <DensitySlider {...props} />
    </div>
  )
}
