import { memo, useMemo, useState } from "react"

import type { MediaAsset } from "../../contracts/domain"
import { buildResponsiveRenditions } from "./mediaSources"

export interface ResponsivePictureProps {
  asset: MediaAsset
  className?: string
  priority?: boolean
  sizes: string
}

function retryUrl(url: string, attempt: number): string {
  if (attempt === 0) return url

  const retry = new URL(url)
  retry.searchParams.set("wall-retry", String(attempt))
  return retry.toString()
}

function retrySrcSet(
  candidates: Array<{ url: string; width: number }>,
  attempt: number,
): string {
  return candidates
    .map((candidate) => `${retryUrl(candidate.url, attempt)} ${candidate.width}w`)
    .join(", ")
}

export const ResponsivePicture = memo(function ResponsivePicture({
  asset,
  className,
  priority = false,
  sizes,
}: ResponsivePictureProps) {
  const [failure, setFailure] = useState({ assetId: asset.id, attempt: 0 })
  const loadAttempt = failure.assetId === asset.id ? failure.attempt : 0
  const renditions = useMemo(() => buildResponsiveRenditions(asset.wall), [asset.wall])
  const recoveryRenditions = useMemo(
    () => buildResponsiveRenditions(asset.lightbox),
    [asset.lightbox],
  )
  const activeFallback = loadAttempt >= 2 && recoveryRenditions.src
    ? recoveryRenditions
    : renditions
  const fallbackSrc = activeFallback.src
    ? retryUrl(activeFallback.src, loadAttempt)
    : undefined
  const fallbackSrcSet = activeFallback.fallback
    ? retrySrcSet(activeFallback.fallback.candidates, loadAttempt)
    : undefined

  return (
    <picture className="contents" data-grid-skip="">
      {loadAttempt === 0 && renditions.sources.map((source) => (
        <source
          key={source.mimeType}
          sizes={sizes}
          srcSet={source.srcSet}
          type={source.mimeType}
        />
      ))}
      <img
        alt=""
        aria-hidden="true"
        className={className}
        data-load-attempt={loadAttempt}
        decoding="async"
        draggable={false}
        fetchPriority={priority ? "high" : "auto"}
        height={asset.height}
        loading="eager"
        onError={() => {
          setFailure((current) => ({
            assetId: asset.id,
            attempt: Math.min(
              2,
              (current.assetId === asset.id ? current.attempt : 0) + 1,
            ),
          }))
        }}
        sizes={sizes}
        src={fallbackSrc}
        srcSet={fallbackSrcSet}
        width={asset.width}
      />
    </picture>
  )
})
