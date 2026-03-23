/**
 * 云函数调用增强模块
 * 提供统一的云函数调用封装，支持：
 * - 统一错误处理和提示
 * - 自动loading显示（可选）
 * - 支持缓存（可选）
 * - 支持重试（继承自request.js）
 * - 类型化的函数调用接口
 * - 全链路请求追踪（traceId）
 */

const { callCloudFunction: baseCallCloudFunction } = require('./request.js')
const apiConfig = require('../config/api.config.js')
const {
  generateTraceId,
  getCurrentTraceContext,
  createTraceContext,
  formatLogPrefix
} = require('./trace.js')

// ============ 缓存管理 ============

// 内存缓存存储
const memoryCache = new Map()

// 缓存统计
const cacheStats = {
  hits: 0,
  misses: 0
}

/**
 * 生成缓存键
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作名称
 * @param {Object} data - 请求数据
 * @returns {string} 缓存键
 */
const generateCacheKey = (functionName, action, data) => {
  const dataStr = JSON.stringify(data || {})
  return `${functionName}:${action}:${dataStr}`
}

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {Object|null} 缓存数据或null
 */
const getCache = (key) => {
  const cached = memoryCache.get(key)
  if (!cached) {
    cacheStats.misses++
    return null
  }

  // 检查是否过期
  if (Date.now() > cached.expireAt) {
    memoryCache.delete(key)
    cacheStats.misses++
    return null
  }

  cacheStats.hits++
  return cached.data
}

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {any} data - 数据
 * @param {number} ttl - 过期时间（毫秒）
 */
const setCache = (key, data, ttl) => {
  memoryCache.set(key, {
    data,
    expireAt: Date.now() + ttl,
    createdAt: Date.now()
  })
}

/**
 * 清除指定前缀的缓存
 * @param {string} prefix - 缓存键前缀
 */
const clearCacheByPrefix = (prefix) => {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}

/**
 * 清除所有缓存
 */
const clearAllCache = () => {
  memoryCache.clear()
}

/**
 * 获取缓存统计
 * @returns {Object} 缓存统计信息
 */
const getCacheStats = () => ({
  ...cacheStats,
  size: memoryCache.size,
  hitRate: cacheStats.hits + cacheStats.misses > 0
    ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2) + '%'
    : '0%'
})

// ============ 错误码映射 ============

// 云函数错误码到用户友好消息的映射
const ERROR_MESSAGES = {
  // 通用错误
  [-1]: '系统繁忙，请稍后重试',
  // 参数相关错误 (1001 ~ 1099)
  1001: '请求参数有误',
  1002: '缺少必要参数',
  1003: '参数格式无效',
  // 认证授权错误 (1101 ~ 1199)
  1101: '请先登录',
  1102: '登录已过期，请重新登录',
  1103: '没有权限执行此操作',
  1104: '需要管理员权限',
  // 资源错误 (1201 ~ 1299)
  1201: '请求的资源不存在',
  1202: '资源已存在',
  1203: '资源冲突',
  // 数据库错误 (2001 ~ 2099)
  2001: '数据操作失败',
  2002: '数据库连接失败',
  2003: '数据查询失败',
  2004: '数据创建失败',
  2005: '数据更新失败',
  2006: '数据删除失败',
  // 网络错误 (2101 ~ 2199)
  2101: '网络连接失败',
  2102: '请求超时',
  // 业务逻辑错误 (4001 ~ 4099)
  4001: '操作失败',
  4002: '无效的操作',
  4003: '状态错误',
  4004: '超出限制'
}

/**
 * 获取用户友好的错误消息
 * @param {number} code - 错误码
 * @param {string} defaultMessage - 默认消息
 * @returns {string} 用户友好的错误消息
 */
const getErrorMessage = (code, defaultMessage) => {
  return ERROR_MESSAGES[code] || defaultMessage || '操作失败，请重试'
}

// ============ Loading管理 ============

// 当前loading计数（支持多个并发请求）
let loadingCount = 0
let loadingTimer = null

/**
 * 显示loading
 * @param {string} title - loading标题
 * @param {number} delay - 延迟显示时间（毫秒），避免闪烁
 */
const showLoading = (title = '加载中...', delay = 200) => {
  loadingCount++
  
  // 如果是第一个请求，延迟显示loading
  if (loadingCount === 1) {
    loadingTimer = setTimeout(() => {
      wx.showLoading({
        title,
        mask: true
      })
    }, delay)
  }
}

/**
 * 隐藏loading
 */
const hideLoading = () => {
  loadingCount = Math.max(0, loadingCount - 1)
  
  // 如果所有请求都完成了，隐藏loading
  if (loadingCount === 0) {
    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    wx.hideLoading()
  }
}

// ============ 核心调用方法 ============

/**
 * 增强的云函数调用
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作名称
 * @param {Object} data - 请求数据
 * @param {Object} options - 配置选项
 * @param {boolean} options.showLoading - 是否显示loading，默认false
 * @param {string} options.loadingText - loading文字，默认"加载中..."
 * @param {boolean} options.showError - 是否显示错误提示，默认true
 * @param {number} options.cache - 缓存时间（毫秒），0或不传表示不缓存
 * @param {boolean} options.silent - 是否静默模式（不打印日志），默认false
 * @param {number} options.timeout - 超时时间（毫秒）
 * @param {number} options.retryCount - 重试次数
 * @param {string} options.traceId - 自定义追踪ID（可选，不传则自动生成）
 * @returns {Promise<any>} 云函数返回数据
 */
const call = async (functionName, action, data = {}, options = {}) => {
  const {
    showLoading: shouldShowLoading = false,
    loadingText = '加载中...',
    showError = true,
    cache = 0,
    silent = false,
    timeout,
    retryCount,
    traceId: customTraceId
  } = options

  // 生成或获取追踪ID
  const traceId = customTraceId || generateTraceId()
  const startTime = Date.now()
  const logPrefix = formatLogPrefix(traceId, functionName, action)

  // 根据配置决定是否输出日志
  const enableLog = apiConfig.log?.trace && !silent

  // 生成缓存键
  const cacheKey = cache > 0 ? generateCacheKey(functionName, action, data) : null

  // 尝试从缓存获取
  if (cacheKey) {
    const cachedData = getCache(cacheKey)
    if (cachedData !== null) {
      if (enableLog) {
        const duration = Date.now() - startTime
        console.log(`${logPrefix} Cache hit, duration: ${duration}ms`)
      }
      return cachedData
    }
  }

  // 显示loading
  if (shouldShowLoading) {
    showLoading(loadingText)
  }

  try {
    // 构建请求数据，注入traceId
    const requestData = {
      action,
      data: {
        ...data,
        _traceId: traceId  // 注入追踪ID到请求数据
      }
    }

    // 构建请求选项
    const requestOptions = {
      silent,
      ...(timeout && { timeout }),
      ...(retryCount !== undefined && { retryCount })
    }

    // 调用底层云函数
    const result = await baseCallCloudFunction(functionName, requestData, requestOptions)

    // 计算耗时
    const duration = Date.now() - startTime

    // 处理响应
    if (result && result.code !== undefined) {
      // 标准响应格式
      if (result.code === 0 || result.code === 200) {
        // 成功
        const responseData = result.data

        // 记录成功日志
        if (enableLog) {
          console.log(`${logPrefix} Request completed, duration: ${duration}ms`)
        }

        // 设置缓存
        if (cacheKey && cache > 0) {
          setCache(cacheKey, responseData, cache)
        }

        return responseData
      } else {
        // 业务错误
        const error = new Error(result.message || getErrorMessage(result.code))
        error.code = result.code
        error.data = result.data
        error.traceId = traceId  // 附加traceId到错误对象
        throw error
      }
    }

    // 非标准响应，记录日志并返回
    if (!silent) {
      console.log(`${logPrefix} Non-standard response, duration: ${duration}ms`)
    }
    return result

  } catch (error) {
    // 计算耗时
    const duration = Date.now() - startTime
    
    // 处理错误
    const errorCode = error.code || -1
    const errorMessage = error.message || getErrorMessage(errorCode)

    // 显示错误提示
    if (showError) {
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      })
    }

    // 记录错误日志（包含traceId和耗时）
    if (!silent) {
      console.error(`${logPrefix} Request failed, duration: ${duration}ms, code: ${errorCode}, message: ${errorMessage}`)
    }

    // 确保错误对象包含traceId
    if (!error.traceId) {
      error.traceId = traceId
    }

    // 重新抛出错误
    throw error

  } finally {
    // 隐藏loading
    if (shouldShowLoading) {
      hideLoading()
    }
  }
}

/**
 * 创建云函数调用器
 * 用于创建特定云函数的调用器，简化调用
 * @param {string} functionName - 云函数名称
 * @param {Object} defaultOptions - 默认选项
 * @returns {Function} 调用器函数
 */
const createCaller = (functionName, defaultOptions = {}) => {
  return (action, data = {}, options = {}) => {
    return call(functionName, action, data, {
      ...defaultOptions,
      ...options
    })
  }
}

/**
 * 创建API方法
 * 用于创建特定action的API方法
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作名称
 * @param {Object} defaultOptions - 默认选项
 * @returns {Function} API方法
 */
const createApiMethod = (functionName, action, defaultOptions = {}) => {
  return (data = {}, options = {}) => {
    return call(functionName, action, data, {
      ...defaultOptions,
      ...options
    })
  }
}

// ============ 预定义的云函数调用器 ============

// 根据配置创建调用器
const callers = {
  login: createCaller(apiConfig.cloudFunction.login),
  product: createCaller(apiConfig.cloudFunction.productManagement),
  category: createCaller(apiConfig.cloudFunction.categoryManagement),
  order: createCaller(apiConfig.cloudFunction.orderManagement),
  process: createCaller(apiConfig.cloudFunction.processManagement)
}

// ============ 缓存失效策略 ============

/**
 * 清除产品相关缓存
 */
const invalidateProductCache = () => {
  clearCacheByPrefix('productManagement:')
}

/**
 * 清除分类相关缓存
 */
const invalidateCategoryCache = () => {
  clearCacheByPrefix('categoryManagement:')
}

/**
 * 清除订单相关缓存
 */
const invalidateOrderCache = () => {
  clearCacheByPrefix('orderManagement:')
}

/**
 * 清除流程相关缓存
 */
const invalidateProcessCache = () => {
  clearCacheByPrefix('processManagement:')
}

// ============ 导出 ============

module.exports = {
  // 核心调用方法
  call,
  
  // 工厂方法
  createCaller,
  createApiMethod,
  
  // 预定义调用器
  callers,
  
  // 缓存管理
  getCache,
  setCache,
  clearCacheByPrefix,
  clearAllCache,
  getCacheStats,
  
  // 缓存失效
  invalidateProductCache,
  invalidateCategoryCache,
  invalidateOrderCache,
  invalidateProcessCache,
  
  // 错误消息
  getErrorMessage,
  ERROR_MESSAGES
}