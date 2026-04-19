import * as React from 'react'

import { ensureTwitterWidgets } from '@/lib/twitter-widgets'

export function TwitterWidgetsScript() {
  React.useEffect(() => {
    void ensureTwitterWidgets()
  }, [])

  return null
}
