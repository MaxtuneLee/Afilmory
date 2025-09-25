import { siteConfig } from '@config'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { photoLoader } from '~/lib/photo-loader'

import geistFont from './Geist-Medium.ttf'
import Sans from './PingFangSC.ttf'

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) => {
  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  try {
    // 格式化拍摄时间
    const dateTaken = photo.exif?.DateTimeOriginal || photo.lastModified
    const formattedDate = dateTaken
      ? new Date(dateTaken).toLocaleDateString('en-US')
      : ''

    // 处理标签
    const tags = photo.tags?.slice(0, 3).join(' • ') || ''
    // Format EXIF information
    const formatExifInfo = () => {
      if (!photo.exif) return null

      const info = {
        focalLength:
          photo.exif.FocalLengthIn35mmFormat || photo.exif.FocalLength,
        aperture: photo.exif.FNumber ? `f/${photo.exif.FNumber}` : null,
        iso: photo.exif.ISO || null,
        shutterSpeed: `${photo.exif.ExposureTime}s`,
        camera:
          photo.exif.Make && photo.exif.Model
            ? `${photo.exif.Make} ${photo.exif.Model}`
            : null,
      }

      return info
    }

    const exifInfo = formatExifInfo()
    const thumbnailBuffer = await Promise.any([
      fetch(
        `http://localhost:13333${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
      ).then((res) => res.arrayBuffer()),
      process.env.NEXT_PUBLIC_APP_URL
        ? fetch(
            `http://${process.env.NEXT_PUBLIC_APP_URL}${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
          ).then((res) => res.arrayBuffer())
        : Promise.reject(),
      fetch(
        `http://${request.nextUrl.host}${photo.thumbnailUrl.replace('.webp', '.jpg')}`,
      ).then((res) => res.arrayBuffer()),
    ])

    // 计算图片显示尺寸以保持原始比例
    const imageWidth = photo.width || 1
    const imageHeight = photo.height || 1
    const aspectRatio = imageWidth / imageHeight

    // 胶片框的最大尺寸
    const maxFrameWidth = 500
    const maxFrameHeight = 420

    // 计算胶片框尺寸（保持图片比例）
    let frameWidth = maxFrameWidth
    let frameHeight = maxFrameHeight

    if (aspectRatio > maxFrameWidth / maxFrameHeight) {
      // 图片较宽，以宽度为准
      frameHeight = maxFrameWidth / aspectRatio
    } else {
      // 图片较高，以高度为准
      frameWidth = maxFrameHeight * aspectRatio
    }

    // 图片区域尺寸（减去胶片边框）
    const imageAreaWidth = frameWidth - 70
    const imageAreaHeight = frameHeight - 70

    // 计算实际图片显示尺寸
    let displayWidth = imageAreaWidth
    let displayHeight = imageAreaHeight

    if (aspectRatio > imageAreaWidth / imageAreaHeight) {
      // 图片较宽，以宽度为准
      displayHeight = imageAreaWidth / aspectRatio
    } else {
      // 图片较高，以高度为准
      displayWidth = imageAreaHeight * aspectRatio
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background:
              'linear-gradient(145deg, #0d0d0d 0%, #1c1c1c 20%, #121212 40%, #1a1a1a 60%, #0f0f0f 80%, #0a0a0a 100%)',
            padding: '80px',
            fontFamily: 'Geist, system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* 摄影师风格的网格背景 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.03,
              background: `
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />

          {/* 主光源效果 - 左上角 */}
          <div
            style={{
              position: 'absolute',
              top: '0px',
              left: '0px',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(60,60,70,0.15) 0%, rgba(40,40,50,0.08) 40%, transparent 70%)',
            }}
          />

          {/* 副光源效果 - 右下角 */}
          <div
            style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(45,45,55,0.12) 0%, rgba(30,30,40,0.06) 50%, transparent 80%)',
            }}
          />

          {/* 摄影工作室的聚光灯效果 */}
          <div
            style={{
              position: 'absolute',
              top: '5%',
              right: '25%',
              width: '180px',
              height: '480px',
              background:
                'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 60%, transparent 100%)',
              transform: 'rotate(15deg)',
            }}
          />

          {/* 胶片装饰元素 */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              right: '5%',
              width: '30px',
              height: '180px',
              background:
                'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* 胶片孔 */}
            <div
              style={{
                marginTop: '9px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '15px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '15px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '15px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '15px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                marginTop: '15px',
                width: '9px',
                height: '9px',
                background: '#0a0a0a',
                borderRadius: '50%',
              }}
            />
          </div>

          {/* 几何装饰线条 - 多个层次 */}
          <div
            style={{
              position: 'absolute',
              top: '30%',
              right: '12%',
              width: '120px',
              height: '120px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '5px',
              transform: 'rotate(12deg)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '35%',
              right: '15%',
              width: '90px',
              height: '90px',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '3px',
              transform: 'rotate(-8deg)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '12%',
              width: '72px',
              height: '72px',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '50%',
            }}
          />

          {/* 光圈装饰 */}
          <div
            style={{
              position: 'absolute',
              bottom: '40%',
              right: '8%',
              width: '48px',
              height: '48px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 内圈 */}
            <div
              style={{
                width: '30px',
                height: '30px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '15px',
                  height: '15px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '50%',
                }}
              />
            </div>
          </div>

          {/* 主要内容区域 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              maxWidth: '58%',
            }}
          >
            {/* 标题 */}
            <h1
              style={{
                fontSize: '80px',
                fontWeight: 'bold',
                color: 'white',
                margin: '0 0 16px 0',
                lineHeight: '1.1',
                letterSpacing: '1px',
                display: 'flex',
              }}
            >
              {photo.title || 'Untitled Photo'}
            </h1>

            {/* 描述 */}
            <p
              style={{
                fontSize: '36px',
                color: 'rgba(255,255,255,0.9)',
                margin: '0 0 16px 0',
                lineHeight: '1.3',
                letterSpacing: '0.3px',
                display: 'flex',
                fontFamily: 'Geist, SF Pro Display',
              }}
            >
              {photo.description || siteConfig.name || siteConfig.title}
            </p>

            {/* 标签 */}
            {tags && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  margin: '0 0 32px 0',
                }}
              >
                {photo.tags?.slice(0, 3).map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      fontSize: '26px',
                      color: 'rgba(255,255,255,0.9)',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      padding: '12px 20px',
                      borderRadius: '24px',
                      letterSpacing: '0.3px',
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      fontFamily: 'Geist, SF Pro Display',
                    }}
                  >
                    #{tag}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 照片缩略图 - 胶片风格 */}
          {photo.thumbnailUrl && (
            <div
              style={{
                position: 'absolute',
                top: '75px',
                right: '45px',
                width: `${frameWidth}px`,
                height: `${frameHeight}px`,
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                borderRadius: '6px',
                border: '1px solid #2a2a2a',
                boxShadow:
                  '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',

                display: 'flex',
                overflow: 'hidden',
              }}
            >
              {/* 胶片左边的孔洞 */}
              <div
                style={{
                  position: 'absolute',
                  left: '0px',
                  top: '0px',
                  width: '30px',
                  height: '100%',
                  background: 'linear-gradient(90deg, #0a0a0a 0%, #111 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  paddingTop: '25px',
                  paddingBottom: '25px',
                }}
              >
                {/* 胶片孔洞 - 更柔和的边缘 */}
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
              </div>

              {/* 胶片右边的孔洞 */}
              <div
                style={{
                  position: 'absolute',
                  right: '0px',
                  top: '0px',
                  width: '30px',
                  height: '100%',
                  background: 'linear-gradient(90deg, #111 0%, #0a0a0a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  paddingTop: '25px',
                  paddingBottom: '25px',
                }}
              >
                {/* 胶片孔洞 - 更柔和的边缘 */}
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background:
                      'radial-gradient(circle, #000 40%, #222 70%, #333 100%)',
                    borderRadius: '50%',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
              </div>

              {/* 胶片中间的照片区域 */}
              <div
                style={{
                  position: 'absolute',
                  left: '30px',
                  top: '30px',
                  width: `${imageAreaWidth}px`,
                  height: `${imageAreaHeight}px`,
                  background: '#000',
                  borderRadius: '2px',
                  border: '2px solid #1a1a1a',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  <img
                    // @ts-expect-error
                    src={thumbnailBuffer}
                    style={{
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                      objectFit: 'cover',
                    }}
                  />
                </div>

                {/* 胶片光泽效果 - 更柔和 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    background:
                      'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.06) 25%, transparent 45%, transparent 55%, rgba(255,255,255,0.03) 75%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* 胶片顶部和底部的纹理 - 更细腻 */}
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '30px',
                  width: `${imageAreaWidth}px`,
                  height: '30px',
                  background:
                    'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 30%, #1a1a1a 100%)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '30px',
                  width: `${imageAreaWidth}px`,
                  height: '30px',
                  background:
                    'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 30%, #1a1a1a 100%)',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                }}
              />

              {/* 胶片编号 - 更自然的位置 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '38px',
                  fontSize: '14px',
                  color: '#555',
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {photoId.slice(-4).toUpperCase()}
              </div>

              {/* 胶片质感的整体覆盖层 */}
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: '100%',
                  background:
                    'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.01) 50%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          )}

          {/* 底部信息 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '28px',
            }}
          >
            {/* 拍摄时间 */}
            {formattedDate && (
              <div
                style={{
                  fontSize: '28px',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                📸 {formattedDate}
              </div>
            )}
            {/* 相机信息 */}
            {exifInfo?.camera && (
              <div
                style={{
                  fontSize: '25px',
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: '0.3px',
                  display: 'flex',
                }}
              >
                📷 {exifInfo.camera}
              </div>
            )}
            {/* EXIF 信息 */}
            {exifInfo &&
              (exifInfo.aperture ||
                exifInfo.shutterSpeed ||
                exifInfo.iso ||
                exifInfo.focalLength) && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '18px',
                    fontSize: '25px',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  {exifInfo.aperture && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      ⚫ {exifInfo.aperture}
                    </div>
                  )}

                  {exifInfo.shutterSpeed && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      ⏱️ {exifInfo.shutterSpeed}
                    </div>
                  )}

                  {exifInfo.iso && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      📊 ISO {exifInfo.iso}
                    </div>
                  )}

                  {exifInfo.focalLength && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '12px 18px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      🔍 {exifInfo.focalLength}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 628,
        emoji: 'noto',
        fonts: [
          {
            name: 'Geist',
            data: geistFont,
            style: 'normal',
            weight: 400,
          },
          {
            name: 'SF Pro Display',
            data: Sans,
            style: 'normal',
            weight: 400,
          },
        ],
        headers: {
          // Cache 1 years
          'Cache-Control':
            'public, max-age=31536000, stale-while-revalidate=31536000',
          'Cloudflare-CDN-Cache-Control':
            'public, max-age=31536000, stale-while-revalidate=31536000',
        },
      },
    )
  } catch (error) {
    console.error('Failed to generate OG image:', error)
    return new Response(`Failed to generate image, ${error.message}`, {
      status: 500,
    })
  }
}
