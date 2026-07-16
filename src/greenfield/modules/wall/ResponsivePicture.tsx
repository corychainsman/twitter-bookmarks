import { memo } from "react"

import type { MediaAsset } from "../../contracts/domain"
import { buildResponsiveRenditions } from "./mediaSources"

export interface ResponsivePictureProps {
  asset: MediaAsset
  className?: string
  priority?: boolean
  sizes: string
}

export const ResponsivePicture = memo(function ResponsivePicture({
  asset,
  className,
  priority = false,
  sizes,
}: ResponsivePictureProps) {
  const renditions = buildResponsiveRenditions(asset.wall)

  return (
    <picture className="contents" data-grid-skip="">
      {renditions.sources.map((source) => (
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
        decoding="async"
        draggable={false}
        fetchPriority={priority ? "high" : "auto"}
        height={asset.height}
        loading={priority ? "eager" : "lazy"}
        sizes={sizes}
        src={renditions.src}
        srcSet={renditions.fallback?.srcSet}
        width={asset.width}
      />
    </picture>
  )
})
