/**
 * 请求工具类
 * 提供统一的网络请求封装，包含云函数调用和HTTP请求
 * 支持请求重试、超时处理、拦截器机制
 */

const apiConfig = require('../config/api.config.js')
const { safeLog, safeError } = require('./sensitive.js')

// ============ 调试配置 ============
// 根据配置和小程序环境判断是否启用调试日志
const getDebugMode = () => {
  // 优先读取配置中的日志开关
  if (apiConfig.log?.verbose === false) {
    return false
  }
  try {
    const accountInfo = wx.getAccountInfoSync()
    return accountInfo.miniProgram.envVersion !== 'release'
  } catch (e) {
    return false
  }
}
const DEBUG = getDebugMode()

// ============ 默认配置 ============
const DEFAULT_CONFIG = {
  // 默认超时时间（毫秒）
  timeout: apiConfig.timeouts?.cloudFunction || apiConfig.timeout || 15000,
  // 默认重试次数
  retryCount: 3,
  // 默认重试延迟（毫秒）
  retryDelay: 1000,
  // 重试延迟最大值（毫秒）
  maxRetryDelay: 10000
}

// HTTP请求默认配置
const HTTP_DEFAULT_CONFIG = {
  timeout: apiConfig.timeouts?.default || apiConfig.timeout || 10000,
  retryCount: 2,
  retryDelay: 500,
  maxRetryDelay: 5000
}

// ============ 拦截器管理 ============

// 请求拦截器列表
const requestInterceptors = []

// 响应拦截器列表
const responseInterceptors = []

// 错误拦截器列表
const errorInterceptors = []

/**
 * 添加请求拦截器
 * @param {Function} interceptor - 拦截器函数，接收config并返回修改后的config
 * @returns {Function} 移除拦截器的函数
 */
const addRequestInterceptor = (interceptor) => {
  if (typeof interceptor !== 'function') {
    console.warn('[Request] addRequestInterceptor: interceptor must be a function')
    return () => { }
  }
  requestInterceptors.push(interceptor)
  return () => {
    const index = requestInterceptors.indexOf(interceptor)
    if (index > -1) {
      requestInterceptors.splice(index, 1)
    }
  }
}

/**
 * 添加响应拦截器
 * @param {Function} interceptor - 拦截器函数，接收response并返回修改后的response
 * @returns {Function} 移除拦截器的函数
 */
const addResponseInterceptor = (interceptor) => {
  if (typeof interceptor !== 'function') {
    console.warn('[Request] addResponseInterceptor: interceptor must be a function')
    return () => { }
  }
  responseInterceptors.push(interceptor)
  return () => {
    const index = responseInterceptors.indexOf(interceptor)
    if (index > -1) {
      responseInterceptors.splice(index, 1)
    }
  }
}

/**
 * 添加错误拦截器
 * @param {Function} interceptor - 拦截器函数，接收error并返回处理后的error或结果
 * @returns {Function} 移除拦截器的函数
 */
const addErrorInterceptor = (interceptor) => {
  if (typeof interceptor !== 'function') {
    console.warn('[Request] addErrorInterceptor: interceptor must be a function')
    return () => { }
  }
  errorInterceptors.push(interceptor)
  return () => {
    const index = errorInterceptors.indexOf(interceptor)
    if (index > -1) {
      errorInterceptors.splice(index, 1)
    }
  }
}

/**
 * 执行请求拦截器链
 * @param {Object} config - 请求配置
 * @returns {Promise<Object>} 处理后的配置
 */
const runRequestInterceptors = async (config) => {
  let result = { ...config }
  for (const interceptor of requestInterceptors) {
    try {
      result = await interceptor(result)
    } catch (error) {
      safeError('[Request Interceptor Error]', error)
      throw error
    }
  }
  return result
}

/**
 * 执行响应拦截器链
 * @param {Object} response - 响应数据
 * @returns {Promise<Object>} 处理后的响应
 */
const runResponseInterceptors = async (response) => {
  let result = response
  for (const interceptor of responseInterceptors) {
    try {
      result = await interceptor(result)
    } catch (error) {
      safeError('[Response Interceptor Error]', error)
      throw error
    }
  }
  return result
}

/**
 * 执行错误拦截器链
 * @param {Error} error - 错误对象
 * @param {Object} context - 请求上下文
 * @returns {Promise<any>} 处理结果
 */
const runErrorInterceptors = async (error, context) => {
  let result = error
  for (const interceptor of errorInterceptors) {
    try {
      result = await interceptor(result, context)
      // 如果拦截器返回非Error对象，认为错误已被处理
      if (!(result instanceof Error)) {
        return result
      }
    } catch (err) {
      safeError('[Error Interceptor Error]', err)
      result = err
    }
  }
  throw result
}

// ============ 工具函数 ============

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 计算重试延迟（指数退避）
 * @param {number} attempt - 当前重试次数（从0开始）
 * @param {number} baseDelay - 基础延迟
 * @param {number} maxDelay - 最大延迟
 * @returns {number} 延迟毫秒数
 */
const calculateRetryDelay = (attempt, baseDelay, maxDelay) => {
  // 指数退避：delay * 2^attempt，并加入随机抖动
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 30%随机抖动
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * 判断是否为可重试的错误
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否可重试
 */
const isRetryableError = (error) => {
  if (!error) return false

  const errorMessage = (error.message || '').toLowerCase()
  const errorCode = error.errCode || error.code || ''

  // 可重试的错误关键词
  const retryableMessages = [
    'request_timeout',
    'network error',
    'timeout',
    'econnreset',
    'etimedout',
    'enotfound',
    'econnrefused',
    'socket hang up',
    'network request failed',
    'request:fail',
    'system error',
    'service unavailable',
    'bad gateway',
    'gateway timeout'
  ]

  // 可重试的错误码
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    -1, // 系统错误
    -100, // 网络错误
    503, // Service Unavailable
    502, // Bad Gateway
    504, // Gateway Timeout
    408 // Request Timeout
  ]

  // 检查错误消息
  const messageMatch = retryableMessages.some(msg =>
    errorMessage.includes(msg)
  )

  // 检查错误码
  const codeMatch = retryableCodes.includes(errorCode) ||
    retryableCodes.includes(Number(errorCode))

  return messageMatch || codeMatch
}

/**
 * 创建超时Promise
 * @param {number} timeout - 超时毫秒数
 * @param {string} type - 请求类型描述
 * @returns {Promise<never>}
 */
const createTimeoutPromise = (timeout, type = 'Request') => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error('REQUEST_TIMEOUT')
      error.code = 'REQUEST_TIMEOUT'
      error.timeout = timeout
      error.type = type
      reject(error)
    }, timeout)
  })
}

/**
 * 格式化错误对象
 * @param {Error|any} error - 原始错误
 * @param {Object} context - 请求上下文
 * @returns {Error} 格式化后的错误
 */
const formatError = (error, context = {}) => {
  const formattedError = error instanceof Error ? error : new Error(String(error))

  // 附加上下文信息
  formattedError.requestContext = {
    name: context.name,
    action: context.action,
    attempt: context.attempt,
    timestamp: Date.now()
  }

  // 设置错误码
  if (!formattedError.code) {
    if (formattedError.message === 'REQUEST_TIMEOUT') {
      formattedError.code = 'REQUEST_TIMEOUT'
    } else if (formattedError.message.includes('network')) {
      formattedError.code = 'NETWORK_ERROR'
    } else {
      formattedError.code = 'UNKNOWN_ERROR'
    }
  }

  return formattedError
}

// ============ 云函数调用 ============

/**
 * 云函数调用封装
 * 支持重试、超时处理、拦截器
 * @param {string} name - 云函数名称
 * @param {Object} data - 调用参数
 * @param {Object} options - 配置选项
 * @param {number} options.timeout - 超时时间（毫秒）
 * @param {number} options.retryCount - 重试次数
 * @param {number} options.retryDelay - 重试延迟（毫秒）
 * @param {boolean} options.silent - 是否静默模式（不打印日志）
 * @returns {Promise<any>} 云函数返回结果
 */
const callCloudFunction = async (name, data = {}, options = {}) => {
  const config = {
    ...DEFAULT_CONFIG,
    ...options,
    name,
    data
  }

  let lastError = null
  const startTime = Date.now()

  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      // 执行请求拦截器
      const requestConfig = await runRequestInterceptors({
        name,
        data,
        config,
        attempt,
        startTime
      })

      // 调试日志（仅在开发/体验版环境启用）
      if (DEBUG && !config.silent) {
        safeLog('[CloudFunction Request]', {
          name: requestConfig.name,
          data: requestConfig.data,
          attempt: attempt + 1,
          maxAttempts: config.retryCount + 1
        })
      }

      // 执行云函数调用，带超时控制
      const result = await Promise.race([
        wx.cloud.callFunction({
          name: requestConfig.name,
          data: requestConfig.data
        }),
        createTimeoutPromise(config.timeout, 'CloudFunction')
      ])

      // 执行响应拦截器
      const response = await runResponseInterceptors({
        ...result,
        requestConfig,
        duration: Date.now() - startTime
      })

      // 调试日志（仅在开发/体验版环境启用）
      if (DEBUG && !config.silent) {
        safeLog('[CloudFunction Response]', {
          name: requestConfig.name,
          result: response.result,
          duration: Date.now() - startTime
        })
      }

      return response.result

    } catch (error) {
      lastError = formatError(error, { name, attempt: attempt + 1 })

      // 日志记录
      safeError('[CloudFunction Error]', lastError, {
        name,
        attempt: attempt + 1,
        maxAttempts: config.retryCount + 1
      })

      // 判断是否需要重试
      if (attempt < config.retryCount && isRetryableError(lastError)) {
        const retryDelay = calculateRetryDelay(
          attempt,
          config.retryDelay,
          config.maxRetryDelay || DEFAULT_CONFIG.maxRetryDelay
        )

        if (!config.silent) {
          safeLog('[CloudFunction Retry]', {
            name,
            attempt: attempt + 1,
            nextAttempt: attempt + 2,
            retryDelay: Math.round(retryDelay)
          })
        }

        await delay(retryDelay)
        continue
      }

      // 不可重试或已达最大重试次数，执行错误拦截器
      try {
        return await runErrorInterceptors(lastError, { name, data, config })
      } catch (finalError) {
        throw finalError
      }
    }
  }

  throw lastError
}

// ============ HTTP请求 ============

/**
 * HTTP请求封装
 * 支持重试、超时处理、拦截器
 * @param {Object} options - 请求选项
 * @param {string} options.url - 请求URL
 * @param {string} options.method - 请求方法
 * @param {Object} options.data - 请求数据
 * @param {Object} options.header - 请求头
 * @param {number} options.timeout - 超时时间
 * @param {number} options.retryCount - 重试次数
 * @param {boolean} options.silent - 是否静默模式
 * @returns {Promise<any>} 响应数据
 */
const request = async (options = {}) => {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    timeout = HTTP_DEFAULT_CONFIG.timeout,
    retryCount = HTTP_DEFAULT_CONFIG.retryCount,
    retryDelay = HTTP_DEFAULT_CONFIG.retryDelay,
    silent = false
  } = options

  // 合并请求头
  const requestHeader = {
    ...apiConfig.header,
    ...header
  }

  const config = {
    url,
    method,
    data,
    header: requestHeader,
    timeout,
    retryCount,
    retryDelay,
    maxRetryDelay: HTTP_DEFAULT_CONFIG.maxRetryDelay
  }

  let lastError = null
  const startTime = Date.now()

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // 执行请求拦截器
      const requestConfig = await runRequestInterceptors({
        ...config,
        attempt,
        startTime,
        type: 'HTTP'
      })

      // 日志记录
      if (!silent) {
        safeLog('[HTTP Request]', {
          url: requestConfig.url,
          method: requestConfig.method,
          attempt: attempt + 1
        })
      }

      // 执行HTTP请求，带超时控制
      const response = await Promise.race([
        new Promise((resolve, reject) => {
          wx.request({
            url: requestConfig.url,
            method: requestConfig.method,
            data: requestConfig.data,
            header: requestConfig.header,
            timeout: requestConfig.timeout,
            success: resolve,
            fail: (err) => {
              const error = new Error(err.errMsg || 'HTTP request failed')
              error.errCode = err.errCode
              reject(error)
            }
          })
        }),
        createTimeoutPromise(timeout, 'HTTP')
      ])

      // 检查HTTP状态码
      if (response.statusCode < 200 || response.statusCode >= 300) {
        const error = new Error(`HTTP Error: ${response.statusCode}`)
        error.statusCode = response.statusCode
        error.response = response.data
        throw error
      }

      // 执行响应拦截器
      const processedResponse = await runResponseInterceptors({
        data: response.data,
        statusCode: response.statusCode,
        header: response.header,
        requestConfig,
        duration: Date.now() - startTime
      })

      // 日志记录
      if (!silent) {
        safeLog('[HTTP Response]', {
          url: requestConfig.url,
          statusCode: response.statusCode,
          duration: Date.now() - startTime
        })
      }

      return processedResponse.data

    } catch (error) {
      lastError = formatError(error, {
        name: url,
        action: method,
        attempt: attempt + 1
      })

      // 日志记录
      safeError('[HTTP Error]', lastError, {
        url,
        method,
        attempt: attempt + 1
      })

      // 判断是否需要重试
      if (attempt < retryCount && isRetryableError(lastError)) {
        const calculatedDelay = calculateRetryDelay(
          attempt,
          retryDelay,
          config.maxRetryDelay
        )

        if (!silent) {
          safeLog('[HTTP Retry]', {
            url,
            attempt: attempt + 1,
            retryDelay: Math.round(calculatedDelay)
          })
        }

        await delay(calculatedDelay)
        continue
      }

      // 执行错误拦截器
      try {
        return await runErrorInterceptors(lastError, { url, method, data, config })
      } catch (finalError) {
        throw finalError
      }
    }
  }

  throw lastError
}

/**
 * GET请求便捷方法
 * @param {string} url - 请求URL
 * @param {Object} params - 查询参数
 * @param {Object} options - 请求选项
 * @returns {Promise<any>}
 */
const get = (url, params = {}, options = {}) => {
  // 构建查询字符串
  const queryString = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  const fullUrl = queryString ? `${url}?${queryString}` : url

  return request({
    url: fullUrl,
    method: 'GET',
    ...options
  })
}

/**
 * POST请求便捷方法
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<any>}
 */
const post = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  })
}

/**
 * PUT请求便捷方法
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<any>}
 */
const put = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  })
}

/**
 * DELETE请求便捷方法
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<any>}
 */
const del = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  })
}

// ============ 配置获取 ============

/**
 * 获取当前默认配置
 * @returns {Object} 默认配置
 */
const getDefaultConfig = () => ({
  cloudFunction: { ...DEFAULT_CONFIG },
  http: { ...HTTP_DEFAULT_CONFIG }
})

/**
 * 获取拦截器数量
 * @returns {Object} 各类型拦截器数量
 */
const getInterceptorCount = () => ({
  request: requestInterceptors.length,
  response: responseInterceptors.length,
  error: errorInterceptors.length
})

/**
 * 清除所有拦截器
 */
const clearAllInterceptors = () => {
  requestInterceptors.length = 0
  responseInterceptors.length = 0
  errorInterceptors.length = 0
}

// ============ 导出 ============

module.exports = {
  // 云函数调用
  callCloudFunction,

  // HTTP请求
  request,
  get,
  post,
  put,
  del,
  delete: del, // 别名

  // 拦截器管理
  addRequestInterceptor,
  addResponseInterceptor,
  addErrorInterceptor,
  clearAllInterceptors,
  getInterceptorCount,

  // 工具函数
  isRetryableError,
  getDefaultConfig,

  // 配置常量（只读）
  DEFAULT_CONFIG: Object.freeze({ ...DEFAULT_CONFIG }),
  HTTP_DEFAULT_CONFIG: Object.freeze({ ...HTTP_DEFAULT_CONFIG })
}
