import { useMemo, type ReactNode } from 'react'

import {
  GridMediaLifecycleContext,
  type GridMediaLifecycle,
} from '@/components/media/grid-media-lifecycle-context'

export function GridMediaLifecycleProvider({
  children,
  mediaMorphGridId,
  playbackEnabled,
}: GridMediaLifecycle & { children: ReactNode }) {
  const value = useMemo(
    () => ({ mediaMorphGridId, playbackEnabled }),
    [mediaMorphGridId, playbackEnabled],
  )

  return (
    <GridMediaLifecycleContext.Provider value={value}>
      {children}
    </GridMediaLifecycleContext.Provider>
  )
}
