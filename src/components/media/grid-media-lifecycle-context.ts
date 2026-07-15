import { createContext, useContext } from 'react'

export type GridMediaLifecycle = {
  mediaMorphGridId: string | null
  playbackEnabled: boolean
}

export const GridMediaLifecycleContext = createContext<GridMediaLifecycle>({
  mediaMorphGridId: null,
  playbackEnabled: true,
})

export function useGridMediaLifecycle() {
  return useContext(GridMediaLifecycleContext)
}
