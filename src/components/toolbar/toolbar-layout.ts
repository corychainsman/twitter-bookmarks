export type ToolbarOverflowKey =
  | 'sort'
  | 'mode'
  | 'immersive'
  | 'direction'
  | 'imageSearch'
  | 'semanticSource'
  | 'seed'
  | 'rerandomize'
  | 'zoom'

const CONTROL_WIDTH: Record<ToolbarOverflowKey | 'count' | 'search' | 'more', number> = {
  count: 72,
  search: 0,
  sort: 136,
  mode: 36,
  immersive: 36,
  direction: 96,
  imageSearch: 36,
  semanticSource: 72,
  seed: 96,
  rerandomize: 36,
  zoom: 72,
  more: 36,
}

const CONTROL_GAP = 8
const HIDE_PRIORITY: ToolbarOverflowKey[] = [
  'zoom',
  'seed',
  'rerandomize',
  'direction',
  'immersive',
  'mode',
  'semanticSource',
  'imageSearch',
  'sort',
]

export function resolveToolbarOverflow(input: {
  containerWidth: number
  searchExpanded: boolean
  isRandomSort: boolean
  hasSemanticSource: boolean
}): ToolbarOverflowKey[] {
  if (input.containerWidth <= 0) {
    return []
  }

  const searchWidth = input.searchExpanded
    ? Math.max(176, Math.min(input.containerWidth * 0.24, 352))
    : 36

  const visibleControls: ToolbarOverflowKey[] = [
    'sort',
    'direction',
    'imageSearch',
    ...(input.hasSemanticSource ? (['semanticSource'] as const) : []),
    'mode',
    'immersive',
    ...(input.isRandomSort ? (['seed'] as const) : []),
    ...(input.isRandomSort ? (['rerandomize'] as const) : []),
    'zoom',
  ]
  const hidden: ToolbarOverflowKey[] = []

  const getTotalWidth = () => {
    const hiddenSet = new Set(hidden)
    const itemWidths = [
      CONTROL_WIDTH.count,
      searchWidth,
      ...visibleControls
        .filter((key) => !hiddenSet.has(key))
        .map((key) => CONTROL_WIDTH[key]),
      CONTROL_WIDTH.more,
    ]

    return (
      itemWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, itemWidths.length - 1) * CONTROL_GAP
    )
  }

  for (const key of HIDE_PRIORITY) {
    if (getTotalWidth() <= input.containerWidth) {
      break
    }

    if (!visibleControls.includes(key)) {
      continue
    }

    hidden.push(key)
  }

  return hidden
}

export function shouldAutoExpandToolbarSearch(input: {
  containerWidth: number
  isRandomSort: boolean
  hasSemanticSource: boolean
}): boolean {
  if (input.containerWidth <= 0) {
    return false
  }

  return (
    resolveToolbarOverflow({
      ...input,
      searchExpanded: true,
    }).length === 0
  )
}
