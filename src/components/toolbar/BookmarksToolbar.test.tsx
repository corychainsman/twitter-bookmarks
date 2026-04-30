import { fireEvent, render, screen } from '@testing-library/react'
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
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onImageSearch={() => {}}
        onClearSemanticSource={() => {}}
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
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={onModeChange}
        onImmersiveChange={onImmersiveChange}
        onImageSearch={() => {}}
        onClearSemanticSource={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'One image per tweet' }))
    expect(onModeChange).toHaveBeenCalledWith('all')

    await user.click(screen.getByRole('button', { name: 'Hide captions' }))
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
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onImageSearch={() => {}}
        onClearSemanticSource={() => {}}
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
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onImageSearch={() => {}}
        onClearSemanticSource={() => {}}
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
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={onImmersiveChange}
        onImageSearch={() => {}}
        onClearSemanticSource={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show captions' }))
    expect(onImmersiveChange).toHaveBeenCalledWith(false)
  })

  it('searches by a pasted image in the search box', () => {
    const onImageSearch = vi.fn()
    const pastedFile = new File(['image-bytes'], 'pasted.png', {
      type: 'image/png',
    })
    const clipboardItem = {
      kind: 'file',
      type: 'image/png',
      getAsFile: () => pastedFile,
    }

    render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={{ ...queryState, q: 'car' }}
        resultCount={42}
        semanticImagePreviewUrl={null}
        semanticSourceLabel={null}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onImageSearch={onImageSearch}
        onClearSemanticSource={() => {}}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    const pasteEvent = fireEvent.paste(screen.getByRole('searchbox', { name: 'Search bookmarks' }), {
      clipboardData: {
        items: [clipboardItem],
      },
    })

    expect(pasteEvent).toBe(false)
    expect(onImageSearch).toHaveBeenCalledWith(pastedFile)
  })

  it('does not focus the search box when it expands because the toolbar has room', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    )

    try {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        value: 920,
      })

      render(
        <BookmarksToolbar
          canZoomIn
          canZoomOut
          canResetZoom={false}
          currentColumnCount={5}
          queryState={queryState}
          resultCount={42}
          semanticImagePreviewUrl={null}
          semanticSourceLabel={null}
          onSearchChange={() => {}}
          onSortChange={() => {}}
          onDirectionToggle={() => {}}
          onModeChange={() => {}}
          onImmersiveChange={() => {}}
          onImageSearch={() => {}}
          onClearSemanticSource={() => {}}
          onKeepSeedChange={() => {}}
          onRerandomize={() => {}}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onZoomReset={() => {}}
        />,
      )

      const searchbox = await screen.findByRole('searchbox', {
        name: 'Search bookmarks',
      })

      expect(searchbox).not.toHaveFocus()
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
      }
    }
  })

  it('shows an image query badge inside the expanded search box', async () => {
    const user = userEvent.setup()
    const onClearSemanticSource = vi.fn()

    const { container } = render(
      <BookmarksToolbar
        canZoomIn
        canZoomOut
        canResetZoom={false}
        currentColumnCount={5}
        queryState={queryState}
        resultCount={42}
        semanticImagePreviewUrl="blob:http://localhost/pasted-image"
        semanticSourceLabel="Image"
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onModeChange={() => {}}
        onImmersiveChange={() => {}}
        onImageSearch={() => {}}
        onClearSemanticSource={onClearSemanticSource}
        onKeepSeedChange={() => {}}
        onRerandomize={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomReset={() => {}}
      />,
    )

    const image = container.querySelector('img[src="blob:http://localhost/pasted-image"]')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('src', 'blob:http://localhost/pasted-image')
    expect(screen.getByText('Image')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear image search' }))
    expect(onClearSemanticSource).toHaveBeenCalled()
  })
})
