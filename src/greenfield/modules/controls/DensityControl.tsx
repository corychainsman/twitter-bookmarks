import { lazy, Suspense, useState } from "react"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"

import { TouchTarget } from "./TouchTarget"
import type { DensityControlValue } from "./types"

const loadCompactDensityControl = () => import("./CompactDensityControl")
  .then((module) => ({ default: module.CompactDensityControl }))
const CompactDensityControl = lazy(loadCompactDensityControl)
const DesktopDensityControl = lazy(() => import("./DesktopDensityControl")
  .then((module) => ({ default: module.DesktopDensityControl })))

interface DensityControlProps {
  density: DensityControlValue
  compact?: boolean
  onDraft: (value: number) => void
  onCommit: (value: number) => void
  onAuto: () => void
  onOpenChange?: (open: boolean) => void
}

function CompactDensityTrigger({
  onActivate,
}: {
  onActivate: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Adjust wall density"
      className="relative"
      onClick={onActivate}
      onFocus={() => void loadCompactDensityControl()}
      onPointerEnter={() => void loadCompactDensityControl()}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" />
      <TouchTarget />
    </Button>
  )
}

export function DensityControl(props: DensityControlProps) {
  const [compactActive, setCompactActive] = useState(false)

  if (props.compact) {
    const activate = () => {
      setCompactActive(true)
      props.onOpenChange?.(true)
    }

    if (!compactActive) return <CompactDensityTrigger onActivate={activate} />

    return (
      <Suspense fallback={<CompactDensityTrigger onActivate={activate} />}>
        <CompactDensityControl
          density={props.density}
          onDraft={props.onDraft}
          onCommit={props.onCommit}
          onAuto={props.onAuto}
          onOpenChange={(open) => {
            if (!open) setCompactActive(false)
            props.onOpenChange?.(open)
          }}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<div className="h-8 min-w-44 max-w-64 flex-1" aria-hidden="true" />}>
      <DesktopDensityControl
        density={props.density}
        onDraft={props.onDraft}
        onCommit={props.onCommit}
        onAuto={props.onAuto}
      />
    </Suspense>
  )
}
