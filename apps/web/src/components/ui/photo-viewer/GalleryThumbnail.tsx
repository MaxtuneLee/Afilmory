import { m } from 'motion/react'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useMobile } from '~/hooks/useMobile'
import { clsxm } from '~/lib/cn'
import { nextFrame } from '~/lib/dom'
import { Spring } from '~/lib/spring'
import type { PhotoManifest } from '~/types/photo'

import { Thumbhash } from '../thumbhash'

const thumbnailSize = {
  mobile: 48,
  desktop: 64,
}

const thumbnailGapSize = {
  mobile: 8,
  desktop: 12,
}

const thumbnailPaddingSize = {
  mobile: 12,
  desktop: 16,
}

export const GalleryThumbnail: FC<{
  currentIndex: number
  photos: PhotoManifest[]
  onIndexChange: (index: number) => void
  visible?: boolean
}> = ({ currentIndex, photos, onIndexChange, visible = true }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const isMobile = useMobile()

  const [scrollContainerWidth, setScrollContainerWidth] = useState(0)

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      setScrollContainerWidth(scrollContainer.clientWidth)
      const handleResize = () => {
        setScrollContainerWidth(scrollContainer.clientWidth)
      }
      scrollContainer.addEventListener('resize', handleResize)
      return () => {
        scrollContainer.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current

    if (scrollContainer) {
      const containerWidth = scrollContainerWidth
      const thumbnailLeft =
        currentIndex *
          (isMobile ? thumbnailSize.mobile : thumbnailSize.desktop) +
        (isMobile ? thumbnailGapSize.mobile : thumbnailGapSize.desktop) *
          currentIndex
      const thumbnailWidth = isMobile
        ? thumbnailSize.mobile
        : thumbnailSize.desktop

      const scrollLeft = thumbnailLeft - containerWidth / 2 + thumbnailWidth / 2
      nextFrame(() => {
        scrollContainer.scrollTo({
          left: scrollLeft,
          behavior: 'smooth',
        })
      })
    }
  }, [currentIndex, isMobile, scrollContainerWidth])

  // 处理鼠标滚轮事件，映射为横向滚动
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleWheel = (e: WheelEvent) => {
      // 阻止默认的垂直滚动
      e.preventDefault()

      // 优先使用触控板的横向滚动 (deltaX)
      // 如果没有横向滚动，则将垂直滚动 (deltaY) 转换为横向滚动
      const scrollAmount =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      scrollContainer.scrollLeft += scrollAmount
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <m.div
      className="bg-material-medium pb-safe z-10 shrink-0"
      initial={{ y: 100, opacity: 0 }}
      animate={{
        y: visible ? 0 : 48,
        opacity: visible ? 1 : 0,
      }}
      exit={{ y: 100, opacity: 0 }}
      transition={Spring.presets.smooth}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div
        ref={scrollContainerRef}
        className={`scrollbar-none flex overflow-x-auto`}
        style={{
          gap: isMobile ? thumbnailGapSize.mobile : thumbnailGapSize.desktop,
          padding: isMobile
            ? thumbnailPaddingSize.mobile
            : thumbnailPaddingSize.desktop,
        }}
      >
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            className={clsxm(
              `flex-shrink-0 rounded-lg overflow-hidden ring-2 transition-all contain-intrinsic-size`,
              index === currentIndex
                ? 'ring-accent scale-110'
                : 'ring-transparent hover:ring-accent grayscale-50 hover:grayscale-0',
            )}
            style={
              isMobile
                ? {
                    width: thumbnailSize.mobile,
                    height: thumbnailSize.mobile,
                  }
                : {
                    width: thumbnailSize.desktop,
                    height: thumbnailSize.desktop,
                  }
            }
            onClick={() => onIndexChange(index)}
          >
            {photo.thumbHash && (
              <Thumbhash
                thumbHash={photo.thumbHash}
                className="size-fill absolute inset-0"
              />
            )}
            <img
              src={photo.thumbnailUrl}
              alt={photo.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </m.div>
  )
}
