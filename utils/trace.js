/**
 * 请求追踪模块
 * 提供TraceID生成和管理功能，用于全链路请求追踪
 */

// 当前追踪上下文
let currentTraceContext = null

// 字符集用于生成随机字符串
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
const generateRandomString = (length = 6) => {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length))
  }
  return result
}

/**
 * 生成唯一的追踪ID
 * 格式: trace-{timestamp}-{random}
 * 示例: trace-1701234567890-x7k9m2
 * @param {string} prefix - ID前缀，默认为'trace'
 * @returns {string} 追踪ID
 */
const generateTraceId = (prefix = 'trace') => {
  const timestamp = Date.now()
  const random = generateRandomString(6)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * 生成子请求ID
 * 用于并发请求场景，在主traceId基础上添加子序号
 * 格式: {traceId}:{index}
 * 示例: trace-1701234567890-x7k9m2:1
 * @param {string} traceId - 主追踪ID
 * @param {number} index - 子请求索引
 * @returns {string} 子请求ID
 */
const generateSubTraceId = (traceId, index) => {
  return `${traceId}:${index}`
}

/**
 * 追踪上下文类
 * 管理一次请求的完整追踪信息
 */
class TraceContext {
  constructor(traceId) {
    this.traceId = traceId || generateTraceId()
    this.startTime = Date.now()
    this.subRequestCounter = 0
    this.metadata = {}
  }

  /**
   * 获取追踪ID
   * @returns {string} 追踪ID
   */
  getTraceId() {
    return this.traceId
  }

  /**
   * 生成下一个子请求ID
   * @returns {string} 子请求ID
   */
  nextSubTraceId() {
    this.subRequestCounter++
    return generateSubTraceId(this.traceId, this.subRequestCounter)
  }

  /**
   * 获取已用时间（毫秒）
   * @returns {number} 已用时间
   */
  getElapsedTime() {
    return Date.now() - this.startTime
  }

  /**
   * 设置元数据
   * @param {string} key - 键
   * @param {any} value - 值
   */
  setMetadata(key, value) {
    this.metadata[key] = value
  }

  /**
   * 获取元数据
   * @param {string} key - 键
   * @returns {any} 值
   */
  getMetadata(key) {
    return this.metadata[key]
  }

  /**
   * 获取所有元数据
   * @returns {Object} 元数据对象
   */
  getAllMetadata() {
    return { ...this.metadata }
  }
}

/**
 * 创建新的追踪上下文
 * @param {string} traceId - 可选的追踪ID，不传则自动生成
 * @returns {TraceContext} 追踪上下文实例
 */
const createTraceContext = (traceId) => {
  currentTraceContext = new TraceContext(traceId)
  return currentTraceContext
}

/**
 * 获取当前追踪上下文
 * 如果不存在则创建新的
 * @returns {TraceContext} 追踪上下文实例
 */
const getCurrentTraceContext = () => {
  if (!currentTraceContext) {
    currentTraceContext = new TraceContext()
  }
  return currentTraceContext
}

/**
 * 获取当前追踪ID
 * 如果没有上下文则创建新的
 * @returns {string} 追踪ID
 */
const getCurrentTraceId = () => {
  return getCurrentTraceContext().getTraceId()
}

/**
 * 清除当前追踪上下文
 * 通常在请求结束时调用
 */
const clearTraceContext = () => {
  currentTraceContext = null
}

/**
 * 在追踪上下文中执行函数
 * 自动创建和清理追踪上下文
 * @param {Function} fn - 要执行的函数
 * @param {string} traceId - 可选的追踪ID
 * @returns {Promise<any>} 函数执行结果
 */
const withTraceContext = async (fn, traceId) => {
  const context = createTraceContext(traceId)
  try {
    return await fn(context)
  } finally {
    clearTraceContext()
  }
}

/**
 * 批量请求追踪辅助函数
 * 为并发请求生成子追踪ID
 * @param {Array} requests - 请求数组
 * @param {Function} executor - 执行器函数，接收(request, subTraceId)
 * @returns {Promise<Array>} 请求结果数组
 */
const traceMultipleRequests = async (requests, executor) => {
  const context = getCurrentTraceContext()
  const promises = requests.map((request, index) => {
    const subTraceId = context.nextSubTraceId()
    return executor(request, subTraceId)
  })
  return Promise.all(promises)
}

/**
 * 格式化追踪日志前缀
 * @param {string} traceId - 追踪ID
 * @param {string} module - 模块名
 * @param {string} action - 操作名
 * @returns {string} 格式化的日志前缀
 */
const formatLogPrefix = (traceId, module, action) => {
  const parts = [`[${traceId}]`]
  if (module) {
    parts.push(`[${module}]`)
  }
  if (action) {
    parts.push(`[${action}]`)
  }
  return parts.join('')
}

module.exports = {
  // ID生成
  generateTraceId,
  generateSubTraceId,
  generateRandomString,
  
  // 上下文管理
  TraceContext,
  createTraceContext,
  getCurrentTraceContext,
  getCurrentTraceId,
  clearTraceContext,
  
  // 辅助函数
  withTraceContext,
  traceMultipleRequests,
  formatLogPrefix
}