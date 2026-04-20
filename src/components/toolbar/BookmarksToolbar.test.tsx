import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookmarksToolbar } from '@/components/toolbar/BookmarksToolbar'
import { ToolbarOverflowContent } from '@/components/toolbar/toolbar-controls'
import * as breakpointModule from '@/components/toolbar/toolbar-breakpoint'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { QueryState } from '@/features/bookmarks/model'

const queryState: QueryState = {
  q: '',
  sort: 'bookmarked',
  dir: 'desc',
  mode: 'one',
  immersive: false,
  preferMotion: false,
  zoom: 1,
  keepSeed: false,
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  vi.restoreAllMocks()
})

function ensureMatchMedia() {
  if (typeof window.matchMedia === 'function') {
    return
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function isFollowing(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('BookmarksToolbar', () => {
  it('opens search from a compact button and collapses again when emptied and blurred', async () => {
    const user = userEvent.setup()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={queryState}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open search' }))
    const search = screen.getByRole('searchbox', { name: 'Search bookmarks' })
    expect(search).toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open search' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument()
  })

  it('keeps the direction, mode, and immersive controls icon-only but accessible by name', async () => {
    const user = userEvent.setup()
    const onDirectionToggle = vi.fn()
    const onModeChange = vi.fn()
    const onImmersiveChange = vi.fn()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={queryState}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={onDirectionToggle}
        onModeChange={onModeChange}
        onImmersiveChange={onImmersiveChange}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Newest first' }))
    expect(onDirectionToggle).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'One image per tweet' }))
    expect(onModeChange).toHaveBeenCalledWith('all')

    await user.click(screen.getByRole('button', { name: 'Show captions' }))
    expect(onImmersiveChange).toHaveBeenCalledWith(true)
  })

  it('keeps keepSeed in overflow only and preserves the random cluster on the rail', async () => {
    const user = userEvent.setup()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={{ ...queryState, sort: 'random', keepSeed: true }}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Rerandomize' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Seed' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByRole('switch', { name: 'Seed' })).toBeInTheDocument()
  })

  it('uses the desktop popover surface when the breakpoint seam says it should', async () => {
    const user = userEvent.setup()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={queryState}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'More' }))

    const panel = await screen.findByRole('dialog')
    expect(panel).toHaveAttribute('data-slot', 'popover-content')
    expect(panel).toContainElement(await screen.findByRole('link', { name: 'Open Theme Studio' }))
  })

  it('uses the phone sheet surface when the breakpoint seam is mocked below sm', async () => {
    const user = userEvent.setup()
    vi.spyOn(breakpointModule, 'shouldUseDesktopMoreSurface').mockReturnValue(false)
    ensureMatchMedia()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={queryState}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'More' }))

    const panel = await screen.findByRole('dialog')
    expect(panel).toHaveAttribute('data-slot', 'drawer-content')
    expect(panel).toContainElement(await screen.findByRole('link', { name: 'Open Theme Studio' }))
  })

  it('keeps overflow items in rail order with Theme Studio last', () => {
    render(
      <TooltipProvider>
        <ToolbarOverflowContent
          canZoomIn
          canZoomOut
          canResetZoom
          currentColumnCount={5}
          isRandomSort={false}
          queryState={queryState}
          resultCount={42}
          themeStudioHref="/themes"
          overflowKeys={new Set(['count', 'sort', 'direction', 'mode', 'immersive', 'zoom'])}
          onSortChange={() => {}}
          onDirectionToggle={() => {}}
          onModeChange={() => {}}
          onImmersiveChange={() => {}}
          onKeepSeedChange={() => {}}
          onRerandomize={() => {}}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onZoomReset={() => {}}
        />
      </TooltipProvider>,
    )

    const sort = screen.getByRole('combobox', { name: 'Sort order' })
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' })
    const count = screen.getByText('42')
    const themeStudio = screen.getByRole('link', { name: 'Open Theme Studio' })

    expect(isFollowing(sort, zoomOut)).toBe(true)
    expect(isFollowing(zoomOut, count)).toBe(true)
    expect(isFollowing(zoomOut, themeStudio)).toBe(true)
    expect(isFollowing(count, themeStudio)).toBe(true)
  })

  it('reverses overflow items when the bottom sheet is used', () => {
    render(
      <TooltipProvider>
        <ToolbarOverflowContent
          canZoomIn
          canZoomOut
          canResetZoom
          currentColumnCount={5}
          isRandomSort={false}
          queryState={queryState}
          resultCount={42}
          themeStudioHref="/themes"
          overflowKeys={new Set(['count', 'sort', 'direction', 'mode', 'immersive', 'zoom'])}
          onSortChange={() => {}}
          onDirectionToggle={() => {}}
          onModeChange={() => {}}
          onImmersiveChange={() => {}}
          onKeepSeedChange={() => {}}
          onRerandomize={() => {}}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onZoomReset={() => {}}
          reverseOrder
        />
      </TooltipProvider>,
    )

    const themeStudio = screen.getByRole('link', { name: 'Open Theme Studio' })
    const count = screen.getByText('42')
    const sort = screen.getByRole('combobox', { name: 'Sort order' })

    expect(isFollowing(themeStudio, count)).toBe(true)
    expect(isFollowing(count, sort)).toBe(true)
  })
})
