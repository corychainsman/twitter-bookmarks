import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { DensitySlider, type DensitySliderProps } from "./DensitySlider"
import { TouchTarget } from "./TouchTarget"

interface CompactDensityControlProps extends DensitySliderProps {
  onOpenChange: (open: boolean) => void
}

export function CompactDensityControl({
  density,
  onDraft,
  onCommit,
  onAuto,
  onOpenChange,
}: CompactDensityControlProps) {
  return (
    <Popover open onOpenChange={onOpenChange}>
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
              {typeof density.value === "number"
                ? `${Math.round(density.value * 100)}%`
                : "Auto"}
            </p>
          </div>
          <DensitySlider
            density={density}
            onDraft={onDraft}
            onCommit={onCommit}
            onAuto={onAuto}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
