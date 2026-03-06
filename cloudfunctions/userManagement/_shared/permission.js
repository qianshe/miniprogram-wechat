/**
 * 云函数权限校验中间件
 * 提供统一的权限验证功能
 */

// 错误码（与 errorHandler.js 保持一致）
const ErrorCodes = {
  UNAUTHORIZED: 1101,
  FORBIDDEN: 1103,
  ADMIN_REQUIRED: 1104,
  INVALID_TOKEN: 1102
}

// 错误消息
const ErrorMessages = {
  [ErrorCodes.UNAUTHORIZED]: '用户未登录',
  [ErrorCodes.FORBIDDEN]: '权限不足',
  [ErrorCodes.ADMIN_REQUIRED]: '需要管理员权限',
  [ErrorCodes.INVALID_TOKEN]: '无效的令牌'
}

/**
 * 获取调用者身份信息
 * @param {object} context 云函数上下文
 * @returns {object} { openid, unionid, appid, source }
 */
const getCallerIdentity = (context) => {
  const wxContext = context.wxContext || {}
  return {
    openid: wxContext.OPENID || null,
    unionid: wxContext.UNIONID || null,
    appid: wxContext.APPID || null,
    source: wxContext.SOURCE || 'unknown'
  }
}

/**
 * 验证用户是否已登录（有openid）
 * @param {object} context
 * @returns {object} { valid: boolean, identity?: object, error?: object }
 */
const requireLogin = (context) => {
  const identity = getCallerIdentity(context)
  
  if (!identity.openid) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: ErrorMessages[ErrorCodes.UNAUTHORIZED]
      }
    }
  }
  
  return {
    valid: true,
    identity
  }
}

/**
 * 验证管理员身份
 * @param {object} event 云函数事件参数
 * @param {object} context 云函数上下文
 * @param {object} db 数据库实例（可选）
 * @returns {Promise<object>} { valid: boolean, error?: object }
 */
const requireAdmin = async (event, context, db = null) => {
  // 首先检查登录状态
  const loginResult = requireLogin(context)
  if (!loginResult.valid) {
    return loginResult
  }
  
  // 服务端验证管理员身份 - 不信任客户端传来的 _isAdmin
  // 必须通过数据库查询验证
  if (db) {
    try {
      // 优先查询 users 集合的 isAdmin 字段
      const userRecord = await db.collection('users')
        .where({ openid: loginResult.identity.openid })
        .field({ isAdmin: true })
        .get()
      
      if (userRecord.data.length > 0 && userRecord.data[0].isAdmin === true) {
        return {
          valid: true,
          identity: loginResult.identity
        }
      }
      
      // 回退：查询 admins 集合
      const adminRecord = await db.collection('admins')
        .where({ openid: loginResult.identity.openid })
        .get()
      
      if (adminRecord.data.length === 0) {
        return {
          valid: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: '非管理员用户'
          }
        }
      }
    } catch (e) {
      console.warn('管理员验证失败:', e.message)
      return {
        valid: false,
        error: {
          code: ErrorCodes.ADMIN_REQUIRED,
          message: ErrorMessages[ErrorCodes.ADMIN_REQUIRED]
        }
      }
    }
  } else {
    // 没有提供数据库实例，无法验证管理员身份
    console.warn('requireAdmin: 未提供数据库实例，无法验证管理员身份')
    return {
      valid: false,
      error: {
        code: ErrorCodes.ADMIN_REQUIRED,
        message: '无法验证管理员身份'
      }
    }
  }
  
  return {
    valid: true,
    identity: loginResult.identity
  }
}

/**
 * 验证资源所有权
 * @param {object} context 云函数上下文
 * @param {string} resourceOwnerId 资源所有者ID
 * @returns {object}
 */
const requireOwnership = (context, resourceOwnerId) => {
  const loginResult = requireLogin(context)
  if (!loginResult.valid) {
    return loginResult
  }
  
  if (loginResult.identity.openid !== resourceOwnerId) {
    return {
      valid: false,
      error: {
        code: ErrorCodes.FORBIDDEN,
        message: '无权操作此资源'
      }
    }
  }
  
  return {
    valid: true,
    identity: loginResult.identity
  }
}

/**
 * 验证资源所有权或管理员
 * @param {object} event 云函数事件参数
 * @param {object} context 云函数上下文
 * @param {string} resourceOwnerId 资源所有者ID
 * @returns {Promise<object>}
 */
const requireOwnershipOrAdmin = async (event, context, resourceOwnerId) => {
  const loginResult = requireLogin(context)
  if (!loginResult.valid) {
    return loginResult
  }
  
  // 是资源所有者
  if (loginResult.identity.openid === resourceOwnerId) {
    return {
      valid: true,
      identity: loginResult.identity,
      isOwner: true
    }
  }
  
  // 注意：不再信任客户端传来的 _isAdmin
  // 如果需要验证管理员身份，应该使用 requireAdmin 函数并传入 db 实例
  
  return {
    valid: false,
    error: {
      code: ErrorCodes.FORBIDDEN,
      message: '无权操作此资源'
    }
  }
}

/**
 * 权限校验包装器
 * 用于包装云函数处理器，自动进行权限校验
 * @param {string} permissionType 权限类型: 'login' | 'admin' | 'custom'
 * @param {function} handler 原处理函数
 * @param {object} options 选项
 */
const withAuth = (permissionType, handler, options = {}) => {
  return async (event, context) => {
    let authResult
    
    switch (permissionType) {
      case 'login':
        authResult = requireLogin(context)
        break
      case 'admin':
        authResult = await requireAdmin(event, context, options.db)
        break
      case 'custom':
        if (options.validator) {
          authResult = await options.validator(event, context)
        } else {
          authResult = { valid: true }
        }
        break
      default:
        authResult = { valid: true }
    }
    
    if (!authResult.valid) {
      return {
        success: false,
        code: authResult.error.code,
        message: authResult.error.message,
        error: authResult.error
      }
    }
    
    // 将身份信息注入到事件中
    event._identity = authResult.identity
    
    return handler(event, context)
  }
}

/**
 * 创建权限校验错误响应
 * @param {number} code 错误码
 * @param {string} message 错误消息（可选）
 * @returns {object} 错误响应
 */
const permissionError = (code, message = null) => {
  return {
    success: false,
    code: code,
    message: message || ErrorMessages[code] || '权限验证失败',
    error: {
      code: code,
      message: message || ErrorMessages[code] || '权限验证失败'
    }
  }
}

/**
 * 快捷验证函数 - 验证登录状态并返回标准响应
 * @param {object} context 云函数上下文
 * @returns {object|null} 如果未登录返回错误响应，否则返回null
 */
const checkLogin = (context) => {
  const result = requireLogin(context)
  if (!result.valid) {
    return permissionError(result.error.code, result.error.message)
  }
  return null
}

/**
 * 快捷验证函数 - 验证管理员权限并返回标准响应
 * @param {object} event 云函数事件参数
 * @param {object} context 云函数上下文
 * @param {object} db 数据库实例（可选）
 * @returns {Promise<object|null>} 如果非管理员返回错误响应，否则返回null
 */
const checkAdmin = async (event, context, db = null) => {
  const result = await requireAdmin(event, context, db)
  if (!result.valid) {
    return permissionError(result.error.code, result.error.message)
  }
  return null
}

/**
 * 快捷验证函数 - 验证资源所有权并返回标准响应
 * @param {object} context 云函数上下文
 * @param {string} resourceOwnerId 资源所有者ID
 * @returns {object|null} 如果无权限返回错误响应，否则返回null
 */
const checkOwnership = (context, resourceOwnerId) => {
  const result = requireOwnership(context, resourceOwnerId)
  if (!result.valid) {
    return permissionError(result.error.code, result.error.message)
  }
  return null
}

/**
 * 快捷验证函数 - 验证资源所有权或管理员权限
 * @param {object} event 云函数事件参数
 * @param {object} context 云函数上下文
 * @param {string} resourceOwnerId 资源所有者ID
 * @returns {Promise<object|null>} 如果无权限返回错误响应，否则返回null
 */
const checkOwnershipOrAdmin = async (event, context, resourceOwnerId) => {
  const result = await requireOwnershipOrAdmin(event, context, resourceOwnerId)
  if (!result.valid) {
    return permissionError(result.error.code, result.error.message)
  }
  return null
}

/**
 * 通过 openid 查询数据库验证管理员身份
 * @param {string} openid - 用户的 openid
 * @param {object} db - 数据库实例
 * @returns {Promise<boolean>} 是否为管理员
 */
const verifyAdminByOpenid = async (openid, db) => {
  if (!openid || !db) return false
  try {
    const userResult = await db.collection('users')
      .where({ openid })
      .field({ isAdmin: true })
      .get()
    return userResult.data.length > 0 && userResult.data[0].isAdmin === true
  } catch (err) {
    console.error('verifyAdminByOpenid error:', err)
    return false
  }
}

module.exports = {
  // 错误码
  ErrorCodes,
  ErrorMessages,
  
  // 核心验证函数
  getCallerIdentity,
  requireLogin,
  requireAdmin,
  requireOwnership,
  requireOwnershipOrAdmin,
  
  // 简易管理员验证
  verifyAdminByOpenid,
  
  // 包装器
  withAuth,
  
  // 快捷验证函数
  checkLogin,
  checkAdmin,
  checkOwnership,
  checkOwnershipOrAdmin,
  
  // 错误响应
  permissionError
}