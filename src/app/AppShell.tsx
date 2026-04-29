import { BookmarksLightbox } from '@/components/lightbox/BookmarksLightbox'
import { BookmarksToolbar } from '@/components/toolbar/BookmarksToolbar'
import { BookmarksPageContent } from '@/app/bookmarks/BookmarksPageContent'
import { useBookmarksPageController } from '@/app/bookmarks/useBookmarksPageController'

export function AppShell() {
  const {
    docsById,
    masonryLayout,
    queryResult,
    queryState,
    loadingError,
    hasLoadedArtifacts,
    isQueryPending,
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
    onZoomReset,
    onOpenLightbox,
    onCloseLightbox,
    onScrollAnchorApplied,
    scrollAnchorRequest,
  } = useBookmarksPageController()

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[10000px] flex-col">
        <BookmarksToolbar
          canZoomIn={masonryLayout.columnCount > 1}
          canZoomOut={masonryLayout.columnCount < masonryLayout.maxColumnCount}
          canResetZoom={canResetZoom}
          currentColumnCount={masonryLayout.columnCount}
          queryState={queryState}
          resultCount={queryResult.total}
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
          immersive={queryState.immersive}
          isQueryPending={isQueryPending}
          items={visibleItems}
          loadingError={loadingError}
          onInitialMediaReady={onInitialMediaReady}
          onOpen={onOpenLightbox}
          onScrollAnchorApplied={onScrollAnchorApplied}
          ready={hasLoadedArtifacts}
          scrollAnchorRequest={scrollAnchorRequest}
        />
      </div>

      <BookmarksLightbox
        docsById={docsById}
        selection={selection}
        onClose={onCloseLightbox}
        onBrowseSimilar={onBrowseSimilar}
      />
    </div>
  )
}
