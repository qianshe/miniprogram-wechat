/**
 * 云函数统一错误处理模块
 * 提供标准化的错误码定义、响应格式和错误处理包装器
 * 集成追踪日志功能
 */

const { createTraceLogger, extractTraceId } = require('./logger');

// 标准错误码定义
const ErrorCodes = {
  // 成功 (HTTP 200 OK)
  SUCCESS: 200,
  
  // 通用错误 (-1 ~ -99)
  UNKNOWN_ERROR: -1,
  
  // 参数相关错误 (1001 ~ 1099)
  PARAM_ERROR: 1001,           // 参数错误
  PARAM_MISSING: 1002,         // 参数缺失
  PARAM_INVALID: 1003,         // 参数无效
  
  // 认证授权错误 (1101 ~ 1199)
  AUTH_ERROR: 1101,            // 认证错误
  AUTH_EXPIRED: 1102,          // 认证过期
  PERMISSION_DENIED: 1103,     // 权限不足
  ADMIN_REQUIRED: 1104,        // 需要管理员权限
  
  // 资源错误 (1201 ~ 1299)
  NOT_FOUND: 1201,             // 资源不存在
  ALREADY_EXISTS: 1202,        // 资源已存在
  RESOURCE_CONFLICT: 1203,     // 资源冲突
  
  // 数据库错误 (2001 ~ 2099)
  DB_ERROR: 2001,              // 数据库错误
  DB_CONNECTION_ERROR: 2002,   // 数据库连接错误
  DB_QUERY_ERROR: 2003,        // 数据库查询错误
  DB_INSERT_ERROR: 2004,       // 数据库插入错误
  DB_UPDATE_ERROR: 2005,       // 数据库更新错误
  DB_DELETE_ERROR: 2006,       // 数据库删除错误
  
  // 网络错误 (2101 ~ 2199)
  NETWORK_ERROR: 2101,         // 网络错误
  TIMEOUT_ERROR: 2102,         // 超时错误
  
  // 配置错误 (3001 ~ 3099)
  CONFIG_ERROR: 3001,          // 配置错误
  CONFIG_MISSING: 3002,        // 配置缺失
  ENV_VAR_MISSING: 3003,       // 环境变量缺失
  
  // 业务逻辑错误 (4001 ~ 4099)
  BUSINESS_ERROR: 4001,        // 业务逻辑错误
  INVALID_OPERATION: 4002,     // 无效操作
  STATE_ERROR: 4003,           // 状态错误
  LIMIT_EXCEEDED: 4004         // 超出限制
};

// 错误码对应的默认消息
const ErrorMessages = {
  [ErrorCodes.SUCCESS]: '操作成功',
  [ErrorCodes.UNKNOWN_ERROR]: '未知错误',
  [ErrorCodes.PARAM_ERROR]: '参数错误',
  [ErrorCodes.PARAM_MISSING]: '缺少必要参数',
  [ErrorCodes.PARAM_INVALID]: '参数格式无效',
  [ErrorCodes.AUTH_ERROR]: '认证失败',
  [ErrorCodes.AUTH_EXPIRED]: '认证已过期',
  [ErrorCodes.PERMISSION_DENIED]: '权限不足',
  [ErrorCodes.ADMIN_REQUIRED]: '需要管理员权限',
  [ErrorCodes.NOT_FOUND]: '资源不存在',
  [ErrorCodes.ALREADY_EXISTS]: '资源已存在',
  [ErrorCodes.RESOURCE_CONFLICT]: '资源冲突',
  [ErrorCodes.DB_ERROR]: '数据库错误',
  [ErrorCodes.DB_CONNECTION_ERROR]: '数据库连接失败',
  [ErrorCodes.DB_QUERY_ERROR]: '数据库查询失败',
  [ErrorCodes.DB_INSERT_ERROR]: '数据库插入失败',
  [ErrorCodes.DB_UPDATE_ERROR]: '数据库更新失败',
  [ErrorCodes.DB_DELETE_ERROR]: '数据库删除失败',
  [ErrorCodes.NETWORK_ERROR]: '网络错误',
  [ErrorCodes.TIMEOUT_ERROR]: '请求超时',
  [ErrorCodes.CONFIG_ERROR]: '配置错误',
  [ErrorCodes.CONFIG_MISSING]: '配置缺失',
  [ErrorCodes.ENV_VAR_MISSING]: '环境变量未配置',
  [ErrorCodes.BUSINESS_ERROR]: '业务逻辑错误',
  [ErrorCodes.INVALID_OPERATION]: '无效操作',
  [ErrorCodes.STATE_ERROR]: '状态错误',
  [ErrorCodes.LIMIT_EXCEEDED]: '超出限制'
};

/**
 * 创建标准响应格式
 * @param {number} code - 错误码
 * @param {string} message - 消息
 * @param {any} data - 数据
 * @param {object} extra - 额外信息（包含traceId等）
 * @returns {object} 标准响应对象
 */
const createResponse = (code, message, data = null, extra = {}) => {
  const response = {
    code,
    message,
    data,
    timestamp: Date.now()
  };
  
  // 合并额外信息（如traceId）
  if (extra && Object.keys(extra).length > 0) {
    Object.assign(response, extra);
  }
  
  return response;
};

/**
 * 成功响应
 * @param {any} data - 返回数据
 * @param {string} message - 成功消息
 * @returns {object} 成功响应对象
 */
const success = (data = null, message = '操作成功') => {
  return createResponse(ErrorCodes.SUCCESS, message, data);
};

/**
 * 错误响应
 * @param {number} code - 错误码
 * @param {string} message - 错误消息（可选，不传则使用默认消息）
 * @param {any} details - 错误详情（可选）
 * @param {string} traceId - 追踪ID（可选）
 * @returns {object} 错误响应对象
 */
const error = (code, message = null, details = null, traceId = null) => {
  const errorMessage = message || ErrorMessages[code] || '未知错误';
  
  // 记录错误日志（包含traceId）
  const logPrefix = traceId ? `[${traceId}]` : '';
  console.error(`${logPrefix}[ERROR] Code: ${code}, Message: ${errorMessage}`, details ? JSON.stringify(details) : '');
  
  // 构建额外信息
  const extra = {};
  if (traceId) {
    extra._traceId = traceId;
  }
  
  const response = createResponse(code, errorMessage, null, extra);
  
  // 在开发环境下添加详细错误信息
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  return response;
};

/**
 * 参数错误响应
 * @param {string} message - 错误消息
 * @param {string} paramName - 参数名称（可选）
 * @returns {object} 错误响应对象
 */
const paramError = (message = '参数错误', paramName = null) => {
  const errorMsg = paramName ? `${message}: ${paramName}` : message;
  return error(ErrorCodes.PARAM_ERROR, errorMsg);
};

/**
 * 权限错误响应
 * @param {string} message - 错误消息
 * @returns {object} 错误响应对象
 */
const permissionError = (message = '无权限执行此操作') => {
  return error(ErrorCodes.PERMISSION_DENIED, message);
};

/**
 * 资源不存在响应
 * @param {string} resourceName - 资源名称
 * @returns {object} 错误响应对象
 */
const notFoundError = (resourceName = '资源') => {
  return error(ErrorCodes.NOT_FOUND, `${resourceName}不存在`);
};

/**
 * 数据库错误响应
 * @param {string} message - 错误消息
 * @param {Error} err - 原始错误对象
 * @returns {object} 错误响应对象
 */
const dbError = (message = '数据库操作失败', err = null) => {
  return error(ErrorCodes.DB_ERROR, message, err ? { originalError: err.message } : null);
};

/**
 * 包装云函数主逻辑，统一错误处理和追踪日志
 * @param {Function} handler - 云函数主处理函数
 * @param {object} options - 配置选项
 * @param {string} options.functionName - 云函数名称（用于日志）
 * @param {boolean} options.enableTracing - 是否启用追踪（默认true）
 * @returns {Function} 包装后的处理函数
 */
const wrapHandler = (handler, options = {}) => {
  const { functionName = 'CloudFunction', enableTracing = true } = options;
  
  return async (event, context) => {
    // 创建追踪日志记录器
    const logger = enableTracing
      ? createTraceLogger({ functionName, event, context })
      : null;
    
    const traceId = logger ? logger.traceId : extractTraceId(event);
    const startTime = Date.now();
    const requestId = context?.requestId || 'unknown';
    
    // 记录请求开始日志
    if (logger) {
      logger.logRequestStart(event?.data);
    } else {
      console.log(`[${functionName}] Request started`, {
        requestId,
        traceId,
        action: event?.action,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // 执行主处理逻辑，传入logger供业务代码使用
      const result = await handler(event, context, logger);
      
      // 记录请求完成日志
      const executionTime = Date.now() - startTime;
      if (logger) {
        logger.logRequestEnd(result?.code === ErrorCodes.SUCCESS, { code: result?.code });
      } else {
        console.log(`[${functionName}] Request completed`, {
          requestId,
          traceId,
          action: event?.action,
          executionTime: `${executionTime}ms`,
          success: result?.code === ErrorCodes.SUCCESS
        });
      }
      
      // 在响应中添加traceId便于前端追踪
      if (result && typeof result === 'object' && !result._traceId) {
        result._traceId = traceId;
      }
      
      return result;
    } catch (err) {
      // 记录未捕获的错误
      const executionTime = Date.now() - startTime;
      if (logger) {
        logger.error('Uncaught error', err, { action: event?.action });
        logger.logRequestEnd(false);
      } else {
        console.error(`[${traceId}][${functionName}] Uncaught error`, {
          requestId,
          action: event?.action,
          executionTime: `${executionTime}ms`,
          error: err.message,
          stack: err.stack
        });
      }
      
      // 返回统一的错误响应（包含traceId）
      return error(
        ErrorCodes.UNKNOWN_ERROR,
        err.message || '服务器内部错误',
        process.env.NODE_ENV === 'development' ? { stack: err.stack } : null,
        traceId
      );
    }
  };
};

/**
 * 包装云函数主逻辑（带完整追踪支持）
 * 与wrapHandler类似，但会将logger作为第三个参数传递给handler
 * @param {Function} handler - 云函数主处理函数 (event, context, logger) => result
 * @param {object} options - 配置选项
 * @param {string} options.functionName - 云函数名称（用于日志）
 * @returns {Function} 包装后的处理函数
 */
const wrapHandlerWithTracing = (handler, options = {}) => {
  return wrapHandler(handler, { ...options, enableTracing: true });
};

/**
 * 验证必填参数
 * @param {object} params - 参数对象
 * @param {string[]} requiredFields - 必填字段列表
 * @returns {object|null} 如果验证失败返回错误响应，否则返回null
 */
const validateRequired = (params, requiredFields) => {
  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null || params[field] === '') {
      return paramError(`缺少必要参数: ${field}`);
    }
  }
  return null;
};

/**
 * 验证管理员权限
 * @param {boolean} isAdmin - 是否为管理员
 * @returns {object|null} 如果验证失败返回错误响应，否则返回null
 */
const validateAdmin = (isAdmin) => {
  if (!isAdmin) {
    return error(ErrorCodes.ADMIN_REQUIRED, '需要管理员权限');
  }
  return null;
};

/**
 * 安全执行数据库操作
 * @param {Function} operation - 数据库操作函数
 * @param {string} operationName - 操作名称（用于错误消息）
 * @returns {Promise<object>} 操作结果或错误响应
 */
const safeDbOperation = async (operation, operationName = '数据库操作') => {
  try {
    return await operation();
  } catch (err) {
    console.error(`[DB_ERROR] ${operationName}失败:`, err.message, err.stack);
    return dbError(`${operationName}失败`, err);
  }
};

// 导出模块
module.exports = {
  // 错误码
  ErrorCodes,
  ErrorMessages,
  
  // 响应函数
  createResponse,
  success,
  error,
  paramError,
  permissionError,
  notFoundError,
  dbError,
  
  // 包装器和验证器
  wrapHandler,
  wrapHandlerWithTracing,
  validateRequired,
  validateAdmin,
  safeDbOperation
};