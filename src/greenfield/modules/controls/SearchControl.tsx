import { LoaderCircle, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchControlProps {
  value: string
  placeholder?: string
  pending?: boolean
  compact?: boolean
  onChange: (value: string) => void
  onSubmit: (query: string) => void
  className?: string
}

export function SearchControl({
  value,
  placeholder = "Search media",
  pending = false,
  compact = false,
  onChange,
  onSubmit,
  className,
}: SearchControlProps) {
  return (
    <form
      role="search"
      aria-label="Search the media wall"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value.trim())
      }}
      className={cn("relative min-w-0", className)}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 shrink-0 -translate-y-1/2 stroke-muted-foreground"
      />
      <Input
        name="wall-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-11 bg-input/30 pr-12 pl-10 text-base focus-visible:bg-input/50 sm:text-sm",
          compact && "sm:h-8",
        )}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Submit search"
        className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2"
      >
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Search aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span
          aria-hidden="true"
          className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
        />
      </Button>
    </form>
  )
}
