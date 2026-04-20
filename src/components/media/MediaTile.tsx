import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

type MediaTileProps = {
  item: GridItem
  tweet: TweetDoc | undefined
  immersive: boolean
  onOpen: () => void
}

export function MediaTile({ item, tweet, immersive, onOpen }: MediaTileProps) {
  const isMotion = item.mediaType === 'video' || item.mediaType === 'animated_gif'
  const previewUrl = item.posterUrl ?? item.thumbUrl

  return (
    <article className="app-tile group">
      <button
        type="button"
        className="app-tile-button cursor-pointer text-left"
        onClick={onOpen}
      >
        <div className="relative overflow-hidden bg-black">
          <img
            src={isMotion ? previewUrl : item.thumbUrl}
            alt={tweet?.text || 'Bookmarked media'}
            loading="lazy"
            className="block h-auto w-full"
          />

          {!immersive ? (
            <div className="app-media-scrim pointer-events-none absolute inset-x-0 bottom-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="secondary"
                  className="app-media-badge border text-[10px] font-medium tracking-[0.2em] uppercase"
                >
                  {item.mediaType.replace('_', ' ')}
                </Badge>
                {tweet?.authorHandle ? (
                  <span className="text-[11px] font-medium text-white/80">@{tweet.authorHandle}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {!immersive ? (
          <div className="flex flex-col gap-2.5 px-3 pb-3 pt-2.5">
            <p className="app-tile-copy line-clamp-3">
              {tweet?.text || 'Loading tweet details…'}
            </p>
            <div className="app-tile-meta flex items-center justify-between gap-3">
              <span>{formatPostedDate(tweet?.postedAt)}</span>
              <span>{tweet?.folderNames[0] || 'Unfoldered'}</span>
            </div>
          </div>
        ) : null}
      </button>
    </article>
  )
}
