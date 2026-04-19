import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BookmarksToolbar } from '@/components/toolbar/BookmarksToolbar'
import type { QueryState } from '@/features/bookmarks/model'

const queryState: QueryState = {
  q: '',
  sort: 'posted',
  dir: 'desc',
  mode: 'one',
  immersive: false,
  preferMotion: false,
  zoom: 1,
  keepSeed: false,
}

describe('BookmarksToolbar', () => {
  it('always renders the more menu and exposes the theme studio link', async () => {
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

    const link = await screen.findByRole('link', { name: 'Open Theme Studio' })
    expect(link).toHaveAttribute('href', '/themes')
  })

  it('uses single stateful buttons for mode and immersive state', async () => {
    const user = userEvent.setup()
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
        onDirectionToggle={() => {}}
        onModeChange={onModeChange}
        onImmersiveChange={onImmersiveChange}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'One image per tweet' }))
    expect(onModeChange).toHaveBeenCalledWith('all')

    await user.click(screen.getByRole('button', { name: 'Show captions' }))
    expect(onImmersiveChange).toHaveBeenCalledWith(true)
  })

  it('only shows the seed switch when random sort is selected', () => {
    const { rerender } = render(
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

    expect(screen.queryByText('Seed')).not.toBeInTheDocument()

    rerender(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={{ ...queryState, sort: 'random' }}
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

    expect(screen.getByText('Seed')).toBeInTheDocument()
  })

  it('toggles immersive mode off the non-default hidden-captions state', async () => {
    const user = userEvent.setup()
    const onImmersiveChange = vi.fn()

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={{ ...queryState, immersive: true }}
        resultCount={42}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={onImmersiveChange}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Hide captions' }))
    expect(onImmersiveChange).toHaveBeenCalledWith(false)
  })
})
