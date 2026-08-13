import { DensitySlider, type DensitySliderProps } from "./DensitySlider"

export function DesktopDensityControl(props: DensitySliderProps) {
  return (
    <div className="flex min-w-44 max-w-64 flex-1 items-center gap-3">
      <p className="shrink-0 text-sm font-medium text-muted-foreground">Density</p>
      <DensitySlider {...props} />
    </div>
  )
}
