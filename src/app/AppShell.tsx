import * as React from 'react'
import { flushSync } from 'react-dom'

import { BookmarksToolbar } from '@/components/toolbar/BookmarksToolbar'
import { BookmarksPageContent } from '@/app/bookmarks/BookmarksPageContent'
import { useBookmarksPageController } from '@/app/bookmarks/useBookmarksPageController'
import { startMediaViewTransition } from '@/lib/media-view-transition'

const BookmarksLightbox = React.lazy(() =>
  import('@/components/lightbox/BookmarksLightbox').then((module) => ({
    default: module.BookmarksLightbox,
  })),
)

export function AppShell() {
  const {
    docsById,
    masonryLayout,
    queryResult,
    queryState,
    loadingError,
    hasLoadedArtifacts,
    hasFirstQueryResult,
    semanticImagePreviewUrl,
    semanticSourceLabel,
    selection,
    visibleItems,
    canResetZoom,
    onSearchChange,
    onSortChange,
    onDirectionToggle,
    onModeChange,
    onImmersiveChange,
    onImageSearch,
    onClearSemanticSource,
    onInitialMediaReady,
    onKeepSeedChange,
    onRerandomize,
    onBrowseSimilar,
    onZoomIn,
    onZoomOut,
    onPinchZoom,
    onZoomReset,
    onOpenLightbox,
    onLightboxSelectionChange,
    onCloseLightbox,
    onScrollAnchorApplied,
    scrollAnchorRequest,
    viewKey,
  } = useBookmarksPageController()
  const [mediaMorphGridId, setMediaMorphGridId] = React.useState<string | null>(null)

  const openLightbox = React.useCallback(
    (gridId: string) => {
      flushSync(() => setMediaMorphGridId(gridId))
      startMediaViewTransition(() => {
        flushSync(() => onOpenLightbox(gridId))
      })
    },
    [onOpenLightbox],
  )

  const closeLightbox = React.useCallback(() => {
    const transition = startMediaViewTransition(() => {
      flushSync(onCloseLightbox)
    })
    if (transition) {
      void transition.finally(() => setMediaMorphGridId(null))
    } else {
      setMediaMorphGridId(null)
    }
  }, [onCloseLightbox])

  const changeLightboxSelection = React.useCallback(
    (gridId: string) => {
      setMediaMorphGridId(gridId)
      onLightboxSelectionChange(gridId)
    },
    [onLightboxSelectionChange],
  )

  const browseSimilar = React.useCallback(
    (gridId: string) => {
      setMediaMorphGridId(null)
      onBrowseSimilar(gridId)
    },
    [onBrowseSimilar],
  )

  return (
    <div className="isolate min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-[10000px] flex-col">
        <BookmarksToolbar
          canZoomIn={masonryLayout.columnCount > 1}
          canZoomOut={masonryLayout.columnCount < masonryLayout.maxColumnCount}
          canResetZoom={canResetZoom}
          currentColumnCount={masonryLayout.columnCount}
          queryState={queryState}
          resultCount={queryResult.total}
          semanticImagePreviewUrl={semanticImagePreviewUrl}
          semanticSourceLabel={semanticSourceLabel}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onDirectionToggle={onDirectionToggle}
          onModeChange={onModeChange}
          onImmersiveChange={onImmersiveChange}
          onImageSearch={onImageSearch}
          onClearSemanticSource={onClearSemanticSource}
          onKeepSeedChange={onKeepSeedChange}
          onRerandomize={onRerandomize}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
        />

        <BookmarksPageContent
          columnCount={masonryLayout.columnCount}
          docsById={docsById}
          hasFirstQueryResult={hasFirstQueryResult}
          immersive={queryState.immersive}
          items={visibleItems}
          loadingError={loadingError}
          mediaMorphGridId={selection ? null : mediaMorphGridId}
          onInitialMediaReady={onInitialMediaReady}
          onOpen={openLightbox}
          onPinchZoom={onPinchZoom}
          playbackEnabled={!selection}
          onScrollAnchorApplied={onScrollAnchorApplied}
          ready={hasLoadedArtifacts}
          scrollAnchorRequest={scrollAnchorRequest}
          viewKey={viewKey}
        />
      </div>

      {selection ? (
        <React.Suspense fallback={null}>
          <BookmarksLightbox
            docsById={docsById}
            mediaMorphGridId={mediaMorphGridId}
            selection={selection}
            onClose={closeLightbox}
            onBrowseSimilar={browseSimilar}
            onSelectionChange={changeLightboxSelection}
          />
        </React.Suspense>
      ) : null}
    </div>
  )
}
