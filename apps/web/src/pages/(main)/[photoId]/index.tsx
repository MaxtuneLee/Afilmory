import { useMemo, useRef } from 'react'
import { RemoveScroll } from 'react-remove-scroll'

import { NotFound } from '~/components/common/NotFound'
import { PhotoViewer } from '~/components/ui/photo-viewer'
import { RootPortal } from '~/components/ui/portal'
import { RootPortalProvider } from '~/components/ui/portal/provider'
import { useTitle } from '~/hooks/common'
import { useContextPhotos, usePhotoViewer } from '~/hooks/usePhotoViewer'

export const Component = () => {
  const photoViewer = usePhotoViewer()
  const photos = useContextPhotos()

  const ref = useRef<HTMLDivElement>(null)
  const rootPortalValue = useMemo(() => {
    return {
      to: ref.current as HTMLElement,
    }
  }, [])
  useTitle(photos[photoViewer.currentIndex]?.title || 'Not Found')
  if (!photos[photoViewer.currentIndex]) {
    return <NotFound />
  }

  return (
    <RootPortal>
      <RootPortalProvider value={rootPortalValue}>
        <RemoveScroll ref={ref} className="fixed inset-0 z-[9999]">
          <PhotoViewer
            photos={photos}
            currentIndex={photoViewer.currentIndex}
            isOpen={photoViewer.isOpen}
            onClose={photoViewer.closeViewer}
            onIndexChange={photoViewer.goToIndex}
          />
        </RemoveScroll>
      </RootPortalProvider>
    </RootPortal>
  )
}
