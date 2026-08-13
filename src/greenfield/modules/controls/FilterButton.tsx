import { ListFilter, LoaderCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { TouchTarget } from "./TouchTarget"

interface FilterButtonProps {
  open: boolean
  count: number
  controlsId: string
  pending?: boolean
  onClick: () => void
  label?: string
  className?: string
}

export function FilterButton({
  open,
  count,
  controlsId,
  pending = false,
  onClick,
  label = "Filters",
  className,
}: FilterButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onClick}
      className={cn("relative", className)}
    >
      {pending ? (
        <LoaderCircle
          data-icon="inline-start"
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <ListFilter
          data-icon="inline-start"
          aria-hidden="true"
          className="size-4 shrink-0"
        />
      )}
      {label}
      {count > 0 ? (
        <Badge
          variant="secondary"
          aria-label={`${count} selected filter values`}
          className="h-5 min-w-5 px-1.5 tabular-nums"
        >
          {count}
        </Badge>
      ) : null}
      <TouchTarget />
    </Button>
  )
}
