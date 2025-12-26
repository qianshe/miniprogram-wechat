/**
 * 云函数日志中间件
 * 提供基于TraceID的统一日志记录功能
 * 支持全链路请求追踪
 */

const { maskObject, safeLog, safeError, safeWarn } = require('./sensitive');

/**
 * 生成追踪ID（云函数端备用）
 * 当前端未传递traceId时使用
 * @returns {string} 追踪ID
 */
const generateTraceId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `trace-${timestamp}-${random}`;
};

/**
 * 从事件对象中提取追踪ID
 * @param {Object} event - 云函数事件对象
 * @returns {string} 追踪ID
 */
const extractTraceId = (event) => {
  // 优先从data中获取（前端cloudFunction模块注入的位置）
  if (event && event.data && event.data._traceId) {
    return event.data._traceId;
  }
  // 兼容直接在event中传递的情况
  if (event && event._traceId) {
    return event._traceId;
  }
  // 如果没有传递，生成一个新的
  return generateTraceId();
};

/**
 * 格式化日志前缀
 * @param {string} traceId - 追踪ID
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作名称
 * @returns {string} 格式化的日志前缀
 */
const formatPrefix = (traceId, functionName, action) => {
  const parts = [`[${traceId}]`];
  if (functionName) {
    parts.push(`[${functionName}]`);
  }
  if (action) {
    parts.push(`[${action}]`);
  }
  return parts.join('');
};

/**
 * 创建带追踪功能的日志记录器
 * @param {Object} options - 配置选项
 * @param {string} options.functionName - 云函数名称
 * @param {Object} options.event - 云函数事件对象（用于提取traceId和action）
 * @param {Object} options.context - 云函数上下文对象
 * @returns {Object} 日志记录器实例
 */
const createTraceLogger = (options = {}) => {
  const { functionName = 'CloudFunction', event = {}, context = {} } = options;
  
  // 提取追踪ID
  const traceId = extractTraceId(event);
  
  // 提取action
  const action = event.action || 'unknown';
  
  // 记录开始时间
  const startTime = Date.now();
  
  // 请求ID（来自云函数上下文）
  const requestId = context.requestId || 'unknown';
  
  /**
   * 获取当前日志前缀
   * @param {string} customAction - 自定义action（可选）
   * @returns {string} 日志前缀
   */
  const getPrefix = (customAction) => {
    return formatPrefix(traceId, functionName, customAction || action);
  };
  
  /**
   * 获取已用时间
   * @returns {number} 毫秒数
   */
  const getElapsedTime = () => {
    return Date.now() - startTime;
  };
  
  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {any} data - 日志数据（可选，会自动脱敏）
   * @param {string} customAction - 自定义action（可选）
   */
  const info = (message, data, customAction) => {
    const prefix = getPrefix(customAction);
    if (data !== undefined) {
      const safeData = typeof data === 'object' ? maskObject(data) : data;
      console.log(`${prefix} ${message}`, JSON.stringify(safeData));
    } else {
      console.log(`${prefix} ${message}`);
    }
  };
  
  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {any} data - 日志数据（可选，会自动脱敏）
   * @param {string} customAction - 自定义action（可选）
   */
  const warn = (message, data, customAction) => {
    const prefix = getPrefix(customAction);
    if (data !== undefined) {
      const safeData = typeof data === 'object' ? maskObject(data) : data;
      console.warn(`${prefix} ${message}`, JSON.stringify(safeData));
    } else {
      console.warn(`${prefix} ${message}`);
    }
  };
  
  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Error|any} error - 错误对象
   * @param {any} contextData - 上下文数据（可选，会自动脱敏）
   * @param {string} customAction - 自定义action（可选）
   */
  const error = (message, err, contextData, customAction) => {
    const prefix = getPrefix(customAction);
    const errorInfo = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    };
    
    if (contextData) {
      errorInfo.context = maskObject(contextData);
    }
    
    console.error(`${prefix} ${message}`, JSON.stringify(errorInfo));
  };
  
  /**
   * 记录调试日志
   * 仅在开发环境下输出
   * @param {string} message - 日志消息
   * @param {any} data - 日志数据（可选，会自动脱敏）
   * @param {string} customAction - 自定义action（可选）
   */
  const debug = (message, data, customAction) => {
    // 在开发环境或明确开启调试时输出
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const prefix = getPrefix(customAction);
      if (data !== undefined) {
        const safeData = typeof data === 'object' ? maskObject(data) : data;
        console.log(`${prefix} [DEBUG] ${message}`, JSON.stringify(safeData));
      } else {
        console.log(`${prefix} [DEBUG] ${message}`);
      }
    }
  };
  
  /**
   * 记录请求开始
   * @param {Object} params - 请求参数（会自动脱敏）
   */
  const logRequestStart = (params) => {
    const safeParams = params ? maskObject(params) : {};
    info('Request received', { params: safeParams, requestId });
  };
  
  /**
   * 记录请求结束
   * @param {boolean} success - 是否成功
   * @param {any} result - 结果数据（可选，成功时的简要信息）
   */
  const logRequestEnd = (success, result) => {
    const duration = getElapsedTime();
    if (success) {
      info(`Request completed, duration: ${duration}ms`, result ? { summary: result } : undefined);
    } else {
      warn(`Request failed, duration: ${duration}ms`);
    }
  };
  
  /**
   * 记录数据库操作
   * @param {string} operation - 操作类型（query/insert/update/delete）
   * @param {string} collection - 集合名称
   * @param {any} details - 操作详情（可选）
   */
  const logDbOperation = (operation, collection, details) => {
    const message = `DB ${operation} on ${collection}`;
    if (details !== undefined) {
      debug(message, details);
    } else {
      debug(message);
    }
  };
  
  /**
   * 创建子日志记录器（用于特定操作）
   * @param {string} subAction - 子操作名称
   * @returns {Object} 子日志记录器
   */
  const child = (subAction) => {
    return {
      info: (message, data) => info(message, data, `${action}/${subAction}`),
      warn: (message, data) => warn(message, data, `${action}/${subAction}`),
      error: (message, err, ctx) => error(message, err, ctx, `${action}/${subAction}`),
      debug: (message, data) => debug(message, data, `${action}/${subAction}`)
    };
  };
  
  return {
    // 基础属性
    traceId,
    action,
    functionName,
    requestId,
    startTime,
    
    // 日志方法
    info,
    warn,
    error,
    debug,
    
    // 便捷方法
    logRequestStart,
    logRequestEnd,
    logDbOperation,
    
    // 工具方法
    getPrefix,
    getElapsedTime,
    child
  };
};

/**
 * 创建请求追踪中间件
 * 用于包装云函数处理逻辑，自动处理追踪日志
 * @param {Function} handler - 云函数处理函数
 * @param {Object} options - 配置选项
 * @param {string} options.functionName - 云函数名称
 * @returns {Function} 包装后的处理函数
 */
const withTracing = (handler, options = {}) => {
  const { functionName = 'CloudFunction' } = options;
  
  return async (event, context) => {
    // 创建日志记录器
    const logger = createTraceLogger({
      functionName,
      event,
      context
    });
    
    // 记录请求开始
    logger.logRequestStart(event.data);
    
    try {
      // 执行处理逻辑，传入logger
      const result = await handler(event, context, logger);
      
      // 记录请求成功
      logger.logRequestEnd(true, result ? { code: result.code } : undefined);
      
      // 在响应中添加traceId（便于前端追踪）
      if (result && typeof result === 'object') {
        return {
          ...result,
          _traceId: logger.traceId
        };
      }
      
      return result;
    } catch (err) {
      // 记录错误
      logger.error('Unhandled error', err, { action: event.action });
      
      // 记录请求失败
      logger.logRequestEnd(false);
      
      // 重新抛出错误
      throw err;
    }
  };
};

module.exports = {
  // 核心功能
  createTraceLogger,
  withTracing,
  
  // 工具函数
  extractTraceId,
  generateTraceId,
  formatPrefix
};