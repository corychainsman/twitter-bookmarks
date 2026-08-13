import { ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

import { TouchTarget } from "./TouchTarget"
import type { DensityControlValue } from "./types"

export interface DensitySliderProps {
  density: DensityControlValue
  onDraft: (value: number) => void
  onCommit: (value: number) => void
  onAuto: () => void
}

export function DensitySlider({ density, onDraft, onCommit, onAuto }: DensitySliderProps) {
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
