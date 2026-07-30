import { memo, useEffect, useMemo, useRef, useState } from "react"

import type { MediaAsset } from "../../contracts/domain"
import { buildResponsiveRenditions } from "./mediaSources"

export interface ResponsivePictureProps {
  asset: MediaAsset
  className?: string
  preloadMargin?: string
  priority?: boolean
  sizes: string
}

function retryUrl(url: string, attempt: number): string {
  if (attempt < 2) return url

  const retry = new URL(url)
  retry.searchParams.set("wall-retry", String(attempt - 1))
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
  preloadMargin = "800px 0px",
  priority = false,
  sizes,
}: ResponsivePictureProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [admittedAssetId, setAdmittedAssetId] = useState<string | undefined>(
    priority ? asset.id : undefined,
  )
  const [failure, setFailure] = useState({ assetId: asset.id, attempt: 0 })
  const sourceAdmitted = priority || admittedAssetId === asset.id
  const loadAttempt = failure.assetId === asset.id ? failure.attempt : 0
  const renditions = useMemo(() => buildResponsiveRenditions(asset.wall), [asset.wall])
  const fallbackSrc = renditions.src
    ? retryUrl(renditions.src, loadAttempt)
    : undefined
  const fallbackSrcSet = renditions.fallback
    ? retrySrcSet(renditions.fallback.candidates, loadAttempt)
    : undefined

  useEffect(() => {
    const image = imageRef.current
    if (!image || priority || sourceAdmitted) return

    if (typeof IntersectionObserver === "undefined") {
      setAdmittedAssetId(asset.id)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setAdmittedAssetId(asset.id)
        observer.disconnect()
      },
      { rootMargin: preloadMargin, threshold: 0 },
    )

    observer.observe(image)
    return () => observer.disconnect()
  }, [asset.id, preloadMargin, priority, sourceAdmitted])

  return (
    <picture className="contents" data-grid-skip="">
      {sourceAdmitted && loadAttempt === 0 && renditions.sources.map((source) => (
        <source
          key={source.mimeType}
          sizes={sizes}
          srcSet={source.srcSet}
          type={source.mimeType}
        />
      ))}
      <img
        ref={imageRef}
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
        src={sourceAdmitted ? fallbackSrc : undefined}
        srcSet={sourceAdmitted ? fallbackSrcSet : undefined}
        width={asset.width}
      />
    </picture>
  )
})
