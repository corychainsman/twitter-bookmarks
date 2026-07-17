import { Grid2X2, Image, LayoutGrid, SquareStack } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type { ViewMode } from "../../contracts/domain"
import { TouchTarget } from "./TouchTarget"

const MODE_OPTIONS: readonly {
  value: ViewMode
  label: string
  icon: typeof Image
}[] = [
  { value: "asset", label: "Assets", icon: Image },
  { value: "record", label: "Records", icon: SquareStack },
  { value: "hybrid", label: "Hybrid", icon: Grid2X2 },
]

interface ModeControlProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  compact?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ModeControl({
  value,
  onChange,
  compact = false,
  onOpenChange,
}: ModeControlProps) {
  if (compact) {
    return (
      <Select
        value={value}
        onValueChange={(next: ViewMode) => onChange(next)}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger aria-label="Wall grouping mode" className="h-8 max-w-32">
          <LayoutGrid aria-hidden="true" className="size-4 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="center">
          {MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as ViewMode)
      }}
      variant="outline"
      size="sm"
      aria-label="Wall grouping mode"
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            title={option.label}
            className="relative"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="max-xl:sr-only">{option.label}</span>
            <TouchTarget />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
