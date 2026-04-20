import * as React from 'react'

import { MoreHorizontalIcon, SearchIcon } from 'lucide-react'

import type { QueryState } from '@/features/bookmarks/model'
import { shouldUseDesktopMoreSurface } from '@/components/toolbar/toolbar-breakpoint'
import { resolveToolbarOverflow } from '@/components/toolbar/toolbar-layout'
import {
  ToolbarDirectionToggle,
  ToolbarImmersiveToggle,
  ToolbarModeToggle,
  ToolbarOverflowContent,
  ToolbarResultCount,
  ToolbarRerandomizeButton,
  ToolbarSortSelect,
  ToolbarZoomCluster,
  toolbarControlClass,
  toolbarInputControlClass,
  toolbarPopoverPanelClass,
  toolbarSheetPanelClass,
} from '@/components/toolbar/toolbar-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerHandle,
  DrawerHeader,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type BookmarksToolbarProps = {
  canZoomIn: boolean
  canZoomOut: boolean
  canResetZoom: boolean
  currentColumnCount: number
  queryState: QueryState
  resultCount: number
  onSearchChange: (value: string) => void
  onSortChange: (value: QueryState['sort']) => void
  onDirectionToggle: () => void
  onModeChange: (value: QueryState['mode']) => void
  onImmersiveChange: (value: boolean) => void
  onKeepSeedChange: (value: boolean) => void
  onRerandomize: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  dockPosition?: 'top' | 'bottom'
}

function ToolbarSearchControl({
  hasSearchQuery,
  isExpanded,
  onExpand,
  onCollapse,
  value,
  onChange,
}: {
  hasSearchQuery: boolean
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const wasVisibleRef = React.useRef(false)

  React.useEffect(() => {
    const isVisible = isExpanded || hasSearchQuery

    if (isVisible && !wasVisibleRef.current) {
      inputRef.current?.focus()
    }

    wasVisibleRef.current = isVisible
  }, [hasSearchQuery, isExpanded])

  if (!isExpanded && !hasSearchQuery) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Open search"
        className={cn('app-control size-9', toolbarControlClass)}
        onClick={onExpand}
      >
        <SearchIcon />
      </Button>
    )
  }

  return (
    <div className="relative shrink-0 transition-[width] duration-200 ease-out w-[clamp(11rem,24vw,22rem)]">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        data-icon="inline-start"
      />
      <Input
        ref={inputRef}
        id="bookmark-search"
        type="search"
        aria-label="Search bookmarks"
        placeholder="Search"
        value={value}
        onBlur={() => {
          if (!hasSearchQuery) {
            onCollapse()
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !hasSearchQuery) {
            event.currentTarget.blur()
            onCollapse()
          }
        }}
        className={cn('app-control h-9 pl-9 text-sm', toolbarInputControlClass)}
      />
    </div>
  )
}

function ToolbarMoreSurface({
  useDesktopSurface,
  open,
  onOpenChange,
  overflowContent,
}: {
  useDesktopSurface: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  overflowContent: React.ReactNode
}) {
  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="More"
      aria-expanded={open}
      className={cn('app-control shrink-0', toolbarControlClass)}
    >
      <MoreHorizontalIcon />
    </Button>
  )

  if (useDesktopSurface) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className={cn('w-60 p-2.5', toolbarPopoverPanelClass)}>
          {overflowContent}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className={cn('px-0 pb-[max(env(safe-area-inset-bottom),0px)]', toolbarSheetPanelClass)}
      >
        <DrawerHeader className="gap-0 px-0">
          <DrawerHandle />
        </DrawerHeader>
        <div className="px-2.5 pt-2.5">{overflowContent}</div>
      </DrawerContent>
    </Drawer>
  )
}

export function BookmarksToolbar({
  canZoomIn,
  canZoomOut,
  canResetZoom,
  currentColumnCount,
  queryState,
  resultCount,
  onSearchChange,
  onSortChange,
  onDirectionToggle,
  onModeChange,
  onImmersiveChange,
  onKeepSeedChange,
  onRerandomize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  dockPosition = 'top',
}: BookmarksToolbarProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null)
  const themeStudioHref = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/themes`
  const hasSearchQuery = queryState.q.trim().length > 0
  const isRandomSort = queryState.sort === 'random'
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(hasSearchQuery)
  const [toolbarWidth, setToolbarWidth] = React.useState(0)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const useDesktopMoreSurface = shouldUseDesktopMoreSurface()

  React.useEffect(() => {
    const node = toolbarRef.current
    if (!node) {
      return
    }

    setToolbarWidth(node.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setToolbarWidth(entry.contentRect.width)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const overflowKeys = React.useMemo(
    () =>
      new Set(
        resolveToolbarOverflow({
          containerWidth: toolbarWidth,
          searchExpanded: isSearchExpanded || hasSearchQuery,
          isRandomSort,
        }),
      ),
    [hasSearchQuery, isRandomSort, isSearchExpanded, toolbarWidth],
  )

  const collapseSearch = React.useCallback(() => {
    if (!hasSearchQuery) {
      setIsSearchExpanded(false)
    }
  }, [hasSearchQuery])

  const overflowContent = (
    <ToolbarOverflowContent
      canZoomIn={canZoomIn}
      canZoomOut={canZoomOut}
      canResetZoom={canResetZoom}
      currentColumnCount={currentColumnCount}
      isRandomSort={isRandomSort}
      queryState={queryState}
      resultCount={resultCount}
      themeStudioHref={themeStudioHref}
      overflowKeys={overflowKeys}
      onSortChange={onSortChange}
      onDirectionToggle={onDirectionToggle}
      onModeChange={onModeChange}
      onImmersiveChange={onImmersiveChange}
      onKeepSeedChange={onKeepSeedChange}
      onRerandomize={onRerandomize}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onZoomReset={onZoomReset}
      reverseOrder={!useDesktopMoreSurface}
    />
  )

  return (
    <div
      className={cn(
        'app-toolbar sticky z-40',
        dockPosition === 'bottom' ? 'bottom-0' : 'top-0',
      )}
    >
      <TooltipProvider delayDuration={150}>
        <div
          ref={toolbarRef}
          className="app-toolbar-inner mx-auto flex w-full max-w-[1920px] items-center"
        >
          <div className="relative shrink-0">
            <ToolbarSearchControl
              hasSearchQuery={hasSearchQuery}
              isExpanded={isSearchExpanded}
              onExpand={() => setIsSearchExpanded(true)}
              onCollapse={collapseSearch}
              value={queryState.q}
              onChange={onSearchChange}
            />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {!overflowKeys.has('sort') ? (
              isRandomSort ? (
                <div className="flex shrink-0 items-center gap-2">
                  <ToolbarSortSelect value={queryState.sort} onValueChange={onSortChange} />
                  {!overflowKeys.has('rerandomize') ? (
                    <ToolbarRerandomizeButton onRerandomize={onRerandomize} />
                  ) : null}
                </div>
              ) : (
                <ToolbarSortSelect value={queryState.sort} onValueChange={onSortChange} />
              )
            ) : null}

            {!overflowKeys.has('direction') ? (
              <ToolbarDirectionToggle dir={queryState.dir} onToggle={onDirectionToggle} />
            ) : null}

            {!overflowKeys.has('mode') ? (
              <ToolbarModeToggle
                mode={queryState.mode}
                onToggle={() => onModeChange(queryState.mode === 'one' ? 'all' : 'one')}
              />
            ) : null}

            {!overflowKeys.has('immersive') ? (
              <ToolbarImmersiveToggle
                immersive={queryState.immersive}
                onToggle={() => onImmersiveChange(!queryState.immersive)}
              />
            ) : null}

            {!overflowKeys.has('zoom') ? (
              <ToolbarZoomCluster
                canZoomIn={canZoomIn}
                canZoomOut={canZoomOut}
                canResetZoom={canResetZoom}
                currentColumnCount={currentColumnCount}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onZoomReset={onZoomReset}
              />
            ) : null}

            {!overflowKeys.has('count') ? (
              <ToolbarResultCount resultCount={resultCount} />
            ) : null}

            <ToolbarMoreSurface
              useDesktopSurface={useDesktopMoreSurface}
              open={moreOpen}
              onOpenChange={setMoreOpen}
              overflowContent={overflowContent}
            />
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
