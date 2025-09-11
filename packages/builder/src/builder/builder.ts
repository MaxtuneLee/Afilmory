import path from 'node:path'

import type { BuilderConfig } from '@builder'
import { builderConfig } from '@builder'

import { thumbnailExists } from '../image/thumbnail.js'
import { logger } from '../logger/index.js'
import {
  handleDeletedPhotos,
  loadExistingManifest,
  needsUpdate,
  saveManifest,
} from '../manifest/manager.js'
import type { PhotoProcessorOptions } from '../photo/processor.js'
import { processPhoto } from '../photo/processor.js'
import { StorageManager } from '../storage/index.js'
import type {
  AfilmoryManifest,
  CameraInfo,
  LensInfo,
} from '../types/manifest.js'
import type { PhotoManifestItem, ProcessPhotoResult } from '../types/photo.js'
import { ClusterPool } from '../worker/cluster-pool.js'
import { WorkerPool } from '../worker/pool.js'

export interface BuilderOptions {
  isForceMode: boolean
  isForceManifest: boolean
  isForceThumbnails: boolean
  concurrencyLimit?: number // 可选，如果未提供则使用配置文件中的默认值
}

export interface BuilderResult {
  hasUpdates: boolean
  newCount: number
  processedCount: number
  skippedCount: number
  deletedCount: number
  totalPhotos: number
}

class PhotoGalleryBuilder {
  private storageManager: StorageManager
  private config: BuilderConfig

  constructor(config?: Partial<BuilderConfig>) {
    // 合并用户配置和默认配置
    this.config = this.mergeConfig(builderConfig, config)

    // 创建存储管理器
    this.storageManager = new StorageManager(this.config.storage)

    // 配置日志级别
    this.configureLogging()
  }

  private mergeConfig(
    baseConfig: BuilderConfig,
    userConfig?: Partial<BuilderConfig>,
  ): BuilderConfig {
    if (!userConfig) return baseConfig

    return {
      repo: { ...baseConfig.repo, ...userConfig.repo },
      storage: { ...baseConfig.storage, ...userConfig.storage },
      options: { ...baseConfig.options, ...userConfig.options },
      logging: { ...baseConfig.logging, ...userConfig.logging },
      performance: {
        ...baseConfig.performance,
        ...userConfig.performance,
        worker: {
          ...baseConfig.performance.worker,
          ...userConfig.performance?.worker,
        },
      },
    }
  }

  private configureLogging(): void {
    // 这里可以根据配置调整日志设置
    // 目前日志配置在 logger 模块中处理
  }

  async buildManifest(options: BuilderOptions): Promise<BuilderResult> {
    try {
      return await this.#buildManifest(options)
    } catch (error) {
      logger.main.error('❌ 构建 manifest 失败：', error)
      throw error
    }
  }
  /**
   * 构建照片清单
   * @param options 构建选项
   */
  async #buildManifest(options: BuilderOptions): Promise<BuilderResult> {
    const startTime = Date.now()

    this.logBuildStart()

    // 读取现有的 manifest（如果存在）
    const existingManifestItems = await this.loadExistingManifest(options).then(
      (manifest) => manifest.data,
    )
    const existingManifestMap = new Map(
      existingManifestItems.map((item) => [item.s3Key, item]),
    )

    logger.main.info(
      `现有 manifest 包含 ${existingManifestItems.length} 张照片`,
    )

    // 列出存储中的所有文件
    const allObjects = await this.storageManager.listAllFiles()
    logger.main.info(`存储中找到 ${allObjects.length} 个文件`)

    // 检测 Live Photo 配对（如果启用）
    const livePhotoMap = await this.detectLivePhotos(allObjects)
    if (this.config.options.enableLivePhotoDetection) {
      logger.main.info(`检测到 ${livePhotoMap.size} 个 Live Photo`)
    }

    // 列出存储中的所有图片文件
    const imageObjects = await this.storageManager.listImages()
    logger.main.info(`存储中找到 ${imageObjects.length} 张照片`)

    // 创建存储中存在的图片 key 集合，用于检测已删除的图片
    const s3ImageKeys = new Set(imageObjects.map((obj) => obj.key))

    const manifest: PhotoManifestItem[] = []
    let processedCount = 0
    let skippedCount = 0
    let newCount = 0
    let deletedCount = 0

    if (imageObjects.length === 0) {
      logger.main.error('❌ 没有找到需要处理的照片')
      return {
        hasUpdates: false,
        newCount: 0,
        processedCount: 0,
        skippedCount: 0,
        deletedCount: 0,
        totalPhotos: 0,
      }
    }

    // 筛选出实际需要处理的图片
    const tasksToProcess = await this.filterTaskImages(
      imageObjects,
      existingManifestMap,
      options,
    )

    logger.main.info(
      `存储中找到 ${imageObjects.length} 张照片，实际需要处理 ${tasksToProcess.length} 张`,
    )

    // 如果没有任务需要处理，直接使用现有的 manifest
    if (tasksToProcess.length === 0) {
      logger.main.info('💡 没有需要处理的照片，使用现有 manifest')
      manifest.push(
        ...existingManifestItems.filter((item) => s3ImageKeys.has(item.s3Key)),
      )
    } else {
      // 获取并发限制
      const concurrency =
        options.concurrencyLimit ?? this.config.options.defaultConcurrency

      // 根据配置和实际任务数量选择处理模式
      const { useClusterMode } = this.config.performance.worker

      // 如果实际任务数量较少，则不使用 cluster 模式
      const shouldUseCluster =
        useClusterMode && tasksToProcess.length >= concurrency * 2

      logger.main.info(
        `开始${shouldUseCluster ? '多进程' : '并发'}处理任务，${shouldUseCluster ? '进程' : 'Worker'}数：${concurrency}${shouldUseCluster ? `，每进程并发：${this.config.performance.worker.workerConcurrency}` : ''}`,
      )

      const processorOptions: PhotoProcessorOptions = {
        isForceMode: options.isForceMode,
        isForceManifest: options.isForceManifest,
        isForceThumbnails: options.isForceThumbnails,
      }

      let results: ProcessPhotoResult[]

      if (shouldUseCluster) {
        // 创建 Cluster 池（多进程模式）
        const clusterPool = new ClusterPool<ProcessPhotoResult>({
          concurrency,
          totalTasks: tasksToProcess.length,
          workerConcurrency: this.config.performance.worker.workerConcurrency,
          workerEnv: {
            FORCE_MODE: processorOptions.isForceMode.toString(),
            FORCE_MANIFEST: processorOptions.isForceManifest.toString(),
            FORCE_THUMBNAILS: processorOptions.isForceThumbnails.toString(),
          },
          sharedData: {
            existingManifestMap,
            livePhotoMap,
            imageObjects: tasksToProcess,
          },
        })

        // 执行多进程并发处理
        results = await clusterPool.execute()
      } else {
        // 创建传统 Worker 池（主线程并发模式）
        const workerPool = new WorkerPool<ProcessPhotoResult>({
          concurrency,
          totalTasks: tasksToProcess.length,
        })

        // 执行并发处理
        results = await workerPool.execute(async (taskIndex, workerId) => {
          const obj = tasksToProcess[taskIndex]

          // 转换 StorageObject 到旧的 _Object 格式以兼容现有的 processPhoto 函数
          const legacyObj = {
            Key: obj.key,
            Size: obj.size,
            LastModified: obj.lastModified,
            ETag: obj.etag,
          }

          // 转换 Live Photo Map
          const legacyLivePhotoMap = new Map()
          for (const [key, value] of livePhotoMap) {
            legacyLivePhotoMap.set(key, {
              Key: value.key,
              Size: value.size,
              LastModified: value.lastModified,
              ETag: value.etag,
            })
          }

          return await processPhoto(
            legacyObj,
            taskIndex,
            workerId,
            tasksToProcess.length,
            existingManifestMap,
            legacyLivePhotoMap,
            processorOptions,
          )
        })
      }

      // 统计结果并添加到 manifest
      for (const result of results) {
        if (result.item) {
          manifest.push(result.item)

          switch (result.type) {
            case 'new': {
              newCount++
              processedCount++
              break
            }
            case 'processed': {
              processedCount++
              break
            }
            case 'skipped': {
              skippedCount++
              break
            }
          }
        }
      }

      // 添加未处理但仍然存在的照片到 manifest
      for (const [key, item] of existingManifestMap) {
        if (s3ImageKeys.has(key) && !manifest.some((m) => m.s3Key === key)) {
          manifest.push(item)
          skippedCount++
        }
      }
    }

    // 检测并处理已删除的图片
    deletedCount = await handleDeletedPhotos(manifest)

    // 生成相机和镜头集合
    const cameras = this.generateCameraCollection(manifest)
    const lenses = this.generateLensCollection(manifest)

    // 保存 manifest
    await saveManifest(manifest, cameras, lenses)

    // 显示构建结果
    if (this.config.options.showDetailedStats) {
      this.logBuildResults(
        manifest,
        {
          newCount,
          processedCount,
          skippedCount,
          deletedCount,
        },
        Date.now() - startTime,
      )
    }

    // 返回构建结果
    const hasUpdates = newCount > 0 || processedCount > 0 || deletedCount > 0
    return {
      hasUpdates,
      newCount,
      processedCount,
      skippedCount,
      deletedCount,
      totalPhotos: manifest.length,
    }
  }

  private async loadExistingManifest(
    options: BuilderOptions,
  ): Promise<AfilmoryManifest> {
    return options.isForceMode || options.isForceManifest
      ? {
          version: 'v6',
          data: [],
          cameras: [],
          lenses: [],
        }
      : await loadExistingManifest()
  }

  private async detectLivePhotos(
    allObjects: Awaited<ReturnType<StorageManager['listAllFiles']>>,
  ): Promise<Map<string, (typeof allObjects)[0]>> {
    if (!this.config.options.enableLivePhotoDetection) {
      return new Map()
    }

    return await this.storageManager.detectLivePhotos(allObjects)
  }

  private logBuildStart(): void {
    switch (this.config.storage.provider) {
      case 's3': {
        const endpoint = this.config.storage.endpoint || '默认 AWS S3'
        const customDomain = this.config.storage.customDomain || '未设置'
        const { bucket } = this.config.storage
        const prefix = this.config.storage.prefix || '无前缀'

        logger.main.info('🚀 开始从存储获取照片列表...')
        logger.main.info(`🔗 使用端点：${endpoint}`)
        logger.main.info(`🌐 自定义域名：${customDomain}`)
        logger.main.info(`🪣 存储桶：${bucket}`)
        logger.main.info(`📂 前缀：${prefix}`)
        break
      }
      case 'github': {
        const { owner, repo, branch, path } = this.config.storage
        logger.main.info('🚀 开始从存储获取照片列表...')
        logger.main.info(`👤 仓库所有者：${owner}`)
        logger.main.info(`🏷️ 仓库名称：${repo}`)
        logger.main.info(`🌲 分支：${branch}`)
        logger.main.info(`📂 路径：${path}`)
        break
      }
    }
  }

  private logBuildResults(
    manifest: PhotoManifestItem[],
    stats: {
      newCount: number
      processedCount: number
      skippedCount: number
      deletedCount: number
    },
    totalDuration: number,
  ): void {
    const durationSeconds = Math.round(totalDuration / 1000)
    const durationMinutes = Math.floor(durationSeconds / 60)
    const remainingSeconds = durationSeconds % 60

    logger.main.success(`🎉 Manifest 构建完成!`)
    logger.main.info(`📊 处理统计:`)
    logger.main.info(`   📸 总照片数：${manifest.length}`)
    logger.main.info(`   🆕 新增照片：${stats.newCount}`)
    logger.main.info(`   🔄 处理照片：${stats.processedCount}`)
    logger.main.info(`   ⏭️ 跳过照片：${stats.skippedCount}`)
    logger.main.info(`   🗑️ 删除照片：${stats.deletedCount}`)
    logger.main.info(
      `   ⏱️ 总耗时：${durationMinutes > 0 ? `${durationMinutes}分${remainingSeconds}秒` : `${durationSeconds}秒`}`,
    )
  }

  /**
   * 获取当前使用的存储管理器
   */
  getStorageManager(): StorageManager {
    return this.storageManager
  }

  /**
   * 获取当前配置
   */
  getConfig(): BuilderConfig {
    return { ...this.config }
  }

  /**
   * 筛选出实际需要处理的图片
   * @param imageObjects 存储中的图片对象列表
   * @param existingManifestMap 现有 manifest 的映射
   * @param options 构建选项
   * @returns 实际需要处理的图片数组
   */
  private async filterTaskImages(
    imageObjects: Awaited<ReturnType<StorageManager['listImages']>>,
    existingManifestMap: Map<string, PhotoManifestItem>,
    options: BuilderOptions,
  ): Promise<Awaited<ReturnType<StorageManager['listImages']>>> {
    // 强制模式下所有图片都需要处理
    if (options.isForceMode || options.isForceManifest) {
      return imageObjects
    }

    const tasksToProcess: Awaited<ReturnType<StorageManager['listImages']>> = []

    for (const obj of imageObjects) {
      const { key } = obj
      const photoId = path.basename(key, path.extname(key))
      const existingItem = existingManifestMap.get(key)

      // 新图片需要处理
      if (!existingItem) {
        tasksToProcess.push(obj)
        continue
      }

      // 检查是否需要更新（基于修改时间）
      const legacyObj = {
        Key: key,
        Size: obj.size,
        LastModified: obj.lastModified,
        ETag: obj.etag,
      }

      if (needsUpdate(existingItem, legacyObj)) {
        tasksToProcess.push(obj)
        continue
      }

      // 检查缩略图是否存在，如果不存在或强制刷新缩略图则需要处理
      const hasThumbnail = await thumbnailExists(photoId)
      if (!hasThumbnail || options.isForceThumbnails) {
        tasksToProcess.push(obj)
        continue
      }

      // 其他情况下跳过处理
    }

    return tasksToProcess
  }

  /**
   * 生成相机信息集合
   * @param manifest 照片清单数组
   * @returns 唯一相机信息数组
   */
  private generateCameraCollection(
    manifest: PhotoManifestItem[],
  ): CameraInfo[] {
    const cameraMap = new Map<string, CameraInfo>()

    for (const photo of manifest) {
      if (!photo.exif?.Make || !photo.exif?.Model) continue

      const make = photo.exif.Make.trim()
      const model = photo.exif.Model.trim()
      const displayName = `${make} ${model}`

      // 使用 displayName 作为唯一键，避免重复
      if (!cameraMap.has(displayName)) {
        cameraMap.set(displayName, {
          make,
          model,
          displayName,
        })
      }
    }

    // 按 displayName 排序返回
    return Array.from(cameraMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    )
  }

  /**
   * 生成镜头信息集合
   * @param manifest 照片清单数组
   * @returns 唯一镜头信息数组
   */
  private generateLensCollection(manifest: PhotoManifestItem[]): LensInfo[] {
    const lensMap = new Map<string, LensInfo>()

    for (const photo of manifest) {
      if (!photo.exif?.LensModel) continue

      const lensModel = photo.exif.LensModel.trim()
      const lensMake = photo.exif.LensMake?.trim()

      // 生成显示名称：如果有厂商信息则包含，否则只显示型号
      const displayName = lensMake ? `${lensMake} ${lensModel}` : lensModel

      // 使用 displayName 作为唯一键，避免重复
      if (!lensMap.has(displayName)) {
        lensMap.set(displayName, {
          make: lensMake,
          model: lensModel,
          displayName,
        })
      }
    }

    // 按 displayName 排序返回
    return Array.from(lensMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    )
  }
}

// 导出默认的构建器实例
export const defaultBuilder = new PhotoGalleryBuilder()
