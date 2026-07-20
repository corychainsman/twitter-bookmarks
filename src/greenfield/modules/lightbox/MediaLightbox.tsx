import { ChevronLeft, ChevronRight, Info, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import type { MediaAsset, MediaRecord } from "@/greenfield/contracts/domain"

import { MediaViewport } from "./MediaViewport"

interface MediaLightboxProps {
  media?: MediaAsset
  record?: MediaRecord
  sharedElement?: boolean
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  onSelectSibling: (mediaId: string) => void
}

function Metadata({
  media,
  record,
  onSelectSibling,
}: {
  media: MediaAsset
  record?: MediaRecord
  onSelectSibling: (mediaId: string) => void
}) {
  const postedAt = record ? new Date(record.postedAt) : undefined

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {record ? (
          <a
            className="w-fit font-mono text-sm tracking-wide text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={record.authorUrl}
            rel="noreferrer"
            target="_blank"
          >
            {record.sourceLabel}
          </a>
        ) : (
          <p className="font-mono text-sm tracking-wide text-muted-foreground uppercase">
            Media record
          </p>
        )}
        <p className="text-pretty text-base leading-relaxed text-foreground/85 sm:text-sm">
          {media.description}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-white/8 pt-4 text-base sm:text-sm">
        {record && (
          <>
          <dt className="text-muted-foreground">Posted</dt>
          <dd className="tabular-nums">
            <a
              className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={record.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              <time dateTime={record.postedAt}>
                {postedAt?.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </a>
          </dd>
          </>
        )}
        <dt className="text-muted-foreground">Dimensions</dt>
        <dd className="tabular-nums">{media.width} × {media.height}</dd>
      </dl>

      {record && record.assets.length > 1 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">More from this record</h3>
          <ul role="list" className="grid grid-cols-4 gap-2">
            {record.assets.map((sibling) => (
              <li key={sibling.id}>
                <button
                  type="button"
                  aria-label={`Open ${sibling.title}`}
                  aria-current={sibling.id === media.id ? "true" : undefined}
                  className="relative aspect-square w-full overflow-hidden rounded-[min(1vw,var(--radius-md))] bg-muted outline-1 -outline-offset-1 outline-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => onSelectSibling(sibling.id)}
                >
                  <img
                    alt=""
                    className="size-full object-contain"
                    src={sibling.wall[0]?.url}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function MediaLightbox({
  media,
  record,
  sharedElement = false,
  onClose,
  onPrevious,
  onNext,
  onSelectSibling,
}: MediaLightboxProps) {
  const reduceMotion = useReducedMotion()
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!media) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [media])

  useEffect(() => {
    if (!media) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onPrevious()
      if (event.key === "ArrowRight") onNext()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [media, onNext, onPrevious])

  return (
    <Dialog open={Boolean(media)} onOpenChange={(open) => !open && onClose()}>
      {media && (
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 flex size-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none bg-background/96 p-0 ring-0 backdrop-blur-md sm:max-w-none"
        >
          <DialogTitle className="sr-only">{media.title}</DialogTitle>
          <DialogDescription className="sr-only">{media.description}</DialogDescription>
          <motion.div
            className="contents"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-3">
              <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Close lightbox" onClick={onClose}>
                <X className="size-4 shrink-0" aria-hidden="true" />
                <span className="pointer-fine:hidden absolute start-1/2 top-1/2 size-[max(100%,3rem)] -translate-1/2" aria-hidden="true" />
              </Button>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Previous media" onClick={onPrevious}>
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                  <span className="pointer-fine:hidden absolute start-1/2 top-1/2 size-[max(100%,3rem)] -translate-1/2" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Next media" onClick={onNext}>
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                  <span className="pointer-fine:hidden absolute start-1/2 top-1/2 size-[max(100%,3rem)] -translate-1/2" aria-hidden="true" />
                </Button>
                <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <DrawerTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="relative lg:hidden" aria-label="Open media details">
                      <Info className="size-4 shrink-0" aria-hidden="true" />
                      <span className="pointer-fine:hidden absolute start-1/2 top-1/2 size-[max(100%,3rem)] -translate-1/2" aria-hidden="true" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[92dvh] border-white/10 bg-background/98">
                    <DrawerHeader className="sr-only">
                      <DrawerTitle>Media details</DrawerTitle>
                      <DrawerDescription>Record metadata and sibling assets.</DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
                      <Metadata media={media} record={record} onSelectSibling={onSelectSibling} />
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>

            <MediaViewport
              key={media.id}
              media={media}
              sharedElement={sharedElement}
              onClose={onClose}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          </div>

          <aside className="hidden w-88 shrink-0 overflow-y-auto border-s border-white/8 bg-card/45 p-6 lg:block">
            <Metadata media={media} record={record} onSelectSibling={onSelectSibling} />
          </aside>
          </motion.div>
        </DialogContent>
      )}
    </Dialog>
  )
}
