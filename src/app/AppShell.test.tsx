import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '@/app/AppShell'
import * as breakpointModule from '@/components/toolbar/toolbar-breakpoint'

vi.mock('@/app/bookmarks/useBookmarksPageController', () => ({
  useBookmarksPageController: () => ({
    docsById: new Map(),
    masonryLayout: { columnCount: 4, maxColumnCount: 8 },
    queryResult: { total: 42 },
    queryState: {
      q: '',
      sort: 'bookmarked',
      dir: 'desc',
      mode: 'one',
      immersive: false,
      preferMotion: false,
      zoom: 1,
      keepSeed: false,
    },
    loadingError: null,
    hasLoadedArtifacts: true,
    isQueryPending: false,
    selection: null,
    visibleItems: [],
    canResetZoom: false,
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    onDirectionToggle: vi.fn(),
    onModeChange: vi.fn(),
    onImmersiveChange: vi.fn(),
    onKeepSeedChange: vi.fn(),
    onRerandomize: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onOpenLightbox: vi.fn(),
    onCloseLightbox: vi.fn(),
  }),
}))

vi.mock('@/components/toolbar/BookmarksToolbar', () => ({
  BookmarksToolbar: ({
    dockPosition,
  }: {
    dockPosition?: 'top' | 'bottom'
  }) => <div data-slot="toolbar" data-dock={dockPosition ?? 'top'}>Toolbar</div>,
}))

vi.mock('@/app/bookmarks/BookmarksPageContent', () => ({
  BookmarksPageContent: () => <div data-slot="content">Content</div>,
}))

vi.mock('@/components/lightbox/BookmarksLightbox', () => ({
  BookmarksLightbox: () => null,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AppShell', () => {
  it('places the toolbar at the bottom on phone-like surfaces', () => {
    vi.spyOn(breakpointModule, 'shouldUseBottomToolbarDock').mockReturnValue(true)

    render(<AppShell />)

    const content = screen.getByText('Content')
    const toolbar = screen.getByText('Toolbar')

    expect(content.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(toolbar).toHaveAttribute('data-dock', 'bottom')
  })

  it('keeps the toolbar above content on desktop surfaces', () => {
    vi.spyOn(breakpointModule, 'shouldUseBottomToolbarDock').mockReturnValue(false)

    render(<AppShell />)

    const toolbar = screen.getByText('Toolbar')
    const content = screen.getByText('Content')

    expect(toolbar.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(toolbar).toHaveAttribute('data-dock', 'top')
  })
})
