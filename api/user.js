/**
 * 用户API模块
 * 提供用户相关的所有API接口封装
 */

const { call, createApiMethod } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'login'

// ============ API方法定义 ============

/**
 * 用户登录
 * @param {Object} data - 登录数据
 * @param {Object} data.userInfo - 微信用户信息
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 用户信息
 */
const login = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'userLogin', data, {
    showLoading: true,
    loadingText: '登录中...',
    ...options
  })
}

/**
 * 管理员登录
 * @param {Object} data - 登录数据
 * @param {string} data.account - 账号
 * @param {string} data.password - 密码
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 管理员信息
 */
const adminLogin = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'adminLogin', data, {
    showLoading: true,
    loadingText: '登录中...',
    ...options
  })
}

/**
 * 获取当前用户信息
 * @param {Object} options - 调用选项
 * @returns {Promise<Object|null>} 用户信息
 */
const getCurrentUser = async (options = {}) => {
  try {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      return userInfo
    }
    return null
  } catch (err) {
    console.error('[User API] 获取用户信息失败:', err)
    return null
  }
}

/**
 * 保存用户信息到本地
 * @param {Object} userInfo - 用户信息
 */
const saveUserInfo = (userInfo) => {
  try {
    wx.setStorageSync('userInfo', userInfo)
  } catch (err) {
    console.error('[User API] 保存用户信息失败:', err)
  }
}

/**
 * 清除用户登录状态
 * @returns {Promise<Object>} 结果
 */
const logout = async () => {
  try {
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('token')
    wx.removeStorageSync('isAdmin')
    return { success: true }
  } catch (err) {
    console.error('[User API] 退出登录失败:', err)
    throw err
  }
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
const isLoggedIn = () => {
  const userInfo = wx.getStorageSync('userInfo')
  return !!userInfo
}

/**
 * 检查用户是否为管理员
 * @returns {boolean} 是否为管理员
 */
const isAdmin = () => {
  const userInfo = wx.getStorageSync('userInfo')
  return userInfo && (userInfo.isAdmin === true || userInfo.role === 'admin' || userInfo.role === 1)
}

/**
 * 获取用户openid
 * @param {Object} options - 调用选项
 * @returns {Promise<string|null>} openid
 */
const getOpenId = async (options = {}) => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'login',
      data: { action: 'checkUserExists' }
    })
    return result.result?.data?.userInfo?.openid || null
  } catch (error) {
    console.error('[User API] 获取openid失败:', error)
    return null
  }
}

/**
 * 提交用户反馈
 * @param {Object} data - 反馈数据
 * @param {string} data.content - 反馈内容
 * @param {string} data.contact - 联系方式
 * @param {Array} data.images - 图片列表
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const submitFeedback = async (data = {}, options = {}) => {
  const feedbackData = {
    content: data.content,
    contact: data.contact || '',
    images: data.images || [],
    createTime: new Date()
  }

  const userInfo = wx.getStorageSync('userInfo')
  if (userInfo) {
    feedbackData.userId = userInfo.id || userInfo.openid
  }

  try {
    return await call('submitFeedback', 'create', feedbackData, {
      showLoading: true,
      loadingText: '提交中...',
      ...options
    })
  } catch (cloudError) {
    console.warn('[User API] submitFeedback云函数不存在，使用本地模拟:', cloudError.message)
    return {
      id: Date.now().toString(),
      ...feedbackData
    }
  }
}

// ============ 管理员用户管理API ============

/**
 * 管理员获取用户列表
 */
const adminGetUsers = (data = {}, options = {}) => {
  return call('userManagement', 'getUsers', data, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取用户详情
 */
const adminGetUserDetail = (id, options = {}) => {
  return call('userManagement', 'getUserDetail', { id }, {
    showLoading: true,
    ...options
  })
}

/**
 * 设置/取消管理员权限
 */
const adminSetAdminRole = (id, isAdmin, options = {}) => {
  return call('userManagement', 'setAdminRole', { id, isAdmin }, {
    showLoading: true,
    loadingText: isAdmin ? '设置中...' : '取消中...',
    ...options
  })
}

/**
 * 更新用户状态（启用/禁用）
 */
const adminUpdateUserStatus = (id, status, options = {}) => {
  return call('userManagement', 'updateUserStatus', { id, status }, {
    showLoading: true,
    loadingText: status === 1 ? '启用中...' : '禁用中...',
    ...options
  })
}

/**
 * 获取用户总数（用于统计）
 */
const adminGetUserCount = async (options = {}) => {
  try {
    const res = await call('userManagement', 'getUsers', { page: 1, size: 1 }, {
      showLoading: false,
      ...options
    })
    return (res.code === 0 || res.code === 200) ? (res.data?.total || 0) : 0
  } catch (err) {
    console.error('[User API] 获取用户数失败:', err)
    return 0
  }
}

// ============ 导出 ============

module.exports = {
  login,
  adminLogin,
  logout,
  getCurrentUser,
  saveUserInfo,
  getOpenId,
  isLoggedIn,
  isAdmin,
  submitFeedback,
  adminGetUsers,
  adminGetUserDetail,
  adminSetAdminRole,
  adminUpdateUserStatus,
  adminGetUserCount
}
