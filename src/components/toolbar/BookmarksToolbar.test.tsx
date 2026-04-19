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

  it('uses lucide image toggles for mode and immersive state', async () => {
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

    await user.click(screen.getByTitle('All images'))
    expect(onModeChange).toHaveBeenCalledWith('all')

    await user.click(screen.getByTitle('Hide captions'))
    expect(onImmersiveChange).toHaveBeenCalledWith(true)
  })
})
