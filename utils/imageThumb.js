/**
 * 图片缩略图工具
 * 通过 CloudBase 图片处理参数生成缩略图 URL
 */

const DEFAULT_SIZE = 200
const DEFAULT_QUALITY = 75

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function buildThumbUrl(imageUrl, options = {}) {
  if (!imageUrl || typeof imageUrl !== 'string') return ''

  // 本地占位图、base64、已处理图片直接返回
  if (
    imageUrl.startsWith('/') ||
    imageUrl.startsWith('data:') ||
    imageUrl.includes('imageMogr2/')
  ) {
    return imageUrl
  }

  const size = clampNumber(options.size, 40, 2000, DEFAULT_SIZE)
  const quality = clampNumber(options.quality, 1, 100, DEFAULT_QUALITY)
  const separator = imageUrl.includes('?') ? '&' : '?'

  return `${imageUrl}${separator}imageMogr2/thumbnail/${size}x${size}/quality/${quality}`
}

module.exports = {
  buildThumbUrl
}
