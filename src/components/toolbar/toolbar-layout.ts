export type ToolbarOverflowKey =
  | 'folder'
  | 'sort'
  | 'mode'
  | 'immersive'
  | 'count'
  | 'direction'
  | 'seed'
  | 'rerandomize'
  | 'zoom'

const CONTROL_WIDTH: Record<ToolbarOverflowKey | 'search' | 'more', number> = {
  search: 0,
  folder: 148,
  sort: 136,
  mode: 78,
  immersive: 78,
  count: 34,
  direction: 96,
  seed: 96,
  rerandomize: 36,
  zoom: 72,
  more: 36,
}

const CONTROL_GAP = 8
const HIDE_PRIORITY: ToolbarOverflowKey[] = [
  'zoom',
  'seed',
  'count',
  'rerandomize',
  'direction',
  'folder',
  'immersive',
  'mode',
  'sort',
]

export function resolveToolbarOverflow(input: {
  containerWidth: number
  searchExpanded: boolean
  hasFolderControl: boolean
  isRandomSort: boolean
}): ToolbarOverflowKey[] {
  if (input.containerWidth <= 0) {
    return []
  }

  const searchWidth = input.searchExpanded
    ? Math.max(176, Math.min(input.containerWidth * 0.24, 352))
    : 36

  const visibleControls: ToolbarOverflowKey[] = [
    'count',
    ...(input.hasFolderControl ? (['folder'] as const) : []),
    'sort',
    'direction',
    'mode',
    'immersive',
    'seed',
    ...(input.isRandomSort ? (['rerandomize'] as const) : []),
    'zoom',
  ]
  const hidden: ToolbarOverflowKey[] = []

  const getTotalWidth = () => {
    const hiddenSet = new Set(hidden)
    const itemWidths = [
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
