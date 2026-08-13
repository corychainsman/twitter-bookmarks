import { Shuffle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { TouchTarget } from "./TouchTarget"

interface ShuffleButtonProps {
  pending?: boolean
  compact?: boolean
  onClick: () => void
}

export function ShuffleButton({
  pending = false,
  compact = false,
  onClick,
}: ShuffleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      disabled={pending}
      onClick={onClick}
      aria-label="Shuffle wall composition"
      className="relative"
    >
      <Shuffle
        data-icon={compact ? undefined : "inline-start"}
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          pending && "animate-spin motion-reduce:animate-none",
        )}
      />
      {compact ? null : "Shuffle"}
      <TouchTarget />
    </Button>
  )
}
