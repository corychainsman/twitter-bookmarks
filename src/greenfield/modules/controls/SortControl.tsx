import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import type { SortMode } from "../../contracts/domain"
import type { SortOption } from "./types"

interface SortControlProps {
  value: SortMode
  options: SortOption[]
  onChange: (value: SortMode) => void
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function SortControl({
  value,
  options,
  onChange,
  onOpenChange,
  className,
}: SortControlProps) {
  return (
    <Select
      value={value}
      onValueChange={(next: SortMode) => onChange(next)}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger aria-label="Sort results" className={cn("max-w-40", className)}>
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
