/**
 * 权限校验工具
 * 提供统一的权限检查和页面守卫功能
 */

// 用户角色定义
const ROLES = {
  GUEST: 'guest',      // 游客
  USER: 'user',        // 普通用户
  ADMIN: 'admin'       // 管理员
}

// 页面权限配置
const PAGE_PERMISSIONS = {
  // 需要登录的页面
  requireLogin: [
    'pages/order/list/list',
    'pages/order/detail/detail',
    'pages/order/confirm/confirm',
    'pages/user/user',
    'pages/address/address',
    'pages/feedback/feedback'
  ],
  // 需要管理员权限的页面
  requireAdmin: [
    'pages/admin/index/index',
    'pages/admin/login/login',
    'pages/admin/order/list/list',
    'pages/admin/order/create/create',
    'pages/admin/order/qr-code/qr-code',
    'pages/admin/product/list/list',
    'pages/admin/product/create/create',
    'pages/admin/product/edit/edit',
    'pages/admin/product/scan/scan',
    'pages/admin/category/list/list',
    'pages/admin/category/edit/edit',
    'pages/admin/package/list/list',
    'pages/admin/package/edit/edit',
    'pages/admin/process/list/list',
    'pages/admin/user/list/list'
  ]
}

const TAB_BAR_PAGES = [
  '/pages/index/index',
  '/pages/goods/category/category',
  '/pages/user/user'
]

const isTabBarPage = (path = '') => TAB_BAR_PAGES.includes(path)

/**
 * 获取当前用户信息
 */
const getCurrentUser = () => {
  try {
    const userInfo = wx.getStorageSync('userInfo')
    return userInfo || null
  } catch (e) {
    console.error('获取用户信息失败:', e)
    return null
  }
}

/**
 * 获取当前用户角色
 */
const getCurrentRole = () => {
  const user = getCurrentUser()
  if (!user) return ROLES.GUEST
  if (user.isAdmin) return ROLES.ADMIN
  return ROLES.USER
}

/**
 * 检查是否已登录
 */
const isLoggedIn = () => {
  return getCurrentUser() !== null
}

/**
 * 检查是否是管理员
 */
const isAdmin = () => {
  try {
    return wx.getStorageSync('isAdmin') === true
  } catch (e) {
    return false
  }
}

/**
 * 检查页面访问权限
 * @param {string} pagePath 页面路径
 * @returns {object} { allowed: boolean, reason?: string, redirect?: string }
 */
const checkPageAccess = (pagePath) => {
  // 检查是否需要管理员权限
  if (PAGE_PERMISSIONS.requireAdmin.some(p => pagePath.includes(p))) {
    if (!isAdmin()) {
      return {
        allowed: false,
        reason: 'REQUIRE_ADMIN',
        redirect: '/pages/admin/login/login'
      }
    }
  }
  
  // 检查是否需要登录
  if (PAGE_PERMISSIONS.requireLogin.some(p => pagePath.includes(p))) {
    if (!isLoggedIn()) {
      return {
        allowed: false,
        reason: 'REQUIRE_LOGIN',
        redirect: '/pages/index/index'
      }
    }
  }
  
  return { allowed: true }
}

/**
 * 页面守卫 - 在页面 onLoad 中调用
 * @param {object} pageInstance 页面实例 (this)
 * @param {object} options 页面参数
 * @returns {boolean} 是否允许访问
 */
const pageGuard = (pageInstance, options = {}) => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const pagePath = currentPage ? currentPage.route : ''
  
  const result = checkPageAccess(pagePath)
  
  if (!result.allowed) {
    // 显示提示
    const messages = {
      REQUIRE_LOGIN: '请先登录',
      REQUIRE_ADMIN: '需要管理员权限'
    }
    
    wx.showToast({
      title: messages[result.reason] || '无权访问',
      icon: 'none',
      duration: 2000
    })
    
    // 延迟跳转
    setTimeout(() => {
      if (result.redirect) {
        if (isTabBarPage(result.redirect)) {
          wx.switchTab({ url: result.redirect })
        } else {
          wx.redirectTo({
            url: result.redirect,
            fail: () => {
              wx.reLaunch({ url: result.redirect })
            }
          })
        }
      } else {
        wx.navigateBack()
      }
    }, 1500)
    
    return false
  }
  
  return true
}

/**
 * 检查操作权限
 * @param {string} action 操作名称
 * @param {object} resource 资源对象（可选）
 * @returns {boolean}
 */
const checkPermission = (action, resource = null) => {
  const role = getCurrentRole()
  const user = getCurrentUser()
  
  // 权限规则
  const rules = {
    // 订单相关
    'order:create': () => role !== ROLES.GUEST,
    'order:view': () => role !== ROLES.GUEST,
    'order:cancel': () => {
      if (role === ROLES.ADMIN) return true
      // 用户只能取消自己的订单
      return resource && resource.userId === user?.openid
    },
    
    // 商品相关
    'product:view': () => true,
    'product:create': () => role === ROLES.ADMIN,
    'product:edit': () => role === ROLES.ADMIN,
    'product:delete': () => role === ROLES.ADMIN,
    
    // 分类相关
    'category:view': () => true,
    'category:create': () => role === ROLES.ADMIN,
    'category:edit': () => role === ROLES.ADMIN,
    'category:delete': () => role === ROLES.ADMIN,
    
    // 用户相关
    'user:view': () => role !== ROLES.GUEST,
    'user:edit': () => {
      if (role === ROLES.ADMIN) return true
      return resource && resource.openid === user?.openid
    },
    'user:manage': () => role === ROLES.ADMIN,
    'user:setAdmin': () => role === ROLES.ADMIN,
    'user:disable': () => role === ROLES.ADMIN
  }
  
  const rule = rules[action]
  if (!rule) {
    console.warn('未定义的权限规则: ' + action)
    return false
  }
  
  return rule()
}

/**
 * 权限装饰器 - 用于包装需要权限的函数
 * @param {string} action 操作名称
 * @param {function} fn 原函数
 * @returns {function}
 */
const withPermission = (action, fn) => {
  return function(...args) {
    if (!checkPermission(action)) {
      wx.showToast({
        title: '无权执行此操作',
        icon: 'none'
      })
      return Promise.reject(new Error('PERMISSION_DENIED'))
    }
    return fn.apply(this, args)
  }
}

/**
 * 清除用户权限信息（登出时调用）
 */
const clearPermissions = () => {
  try {
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('isAdmin')
    wx.removeStorageSync('openid')
  } catch (e) {
    console.error('清除权限信息失败:', e)
  }
}

/**
 * 设置管理员状态
 * @param {boolean} status
 */
const setAdminStatus = (status) => {
  try {
    wx.setStorageSync('isAdmin', status)
  } catch (e) {
    console.error('设置管理员状态失败:', e)
  }
}

module.exports = {
  ROLES,
  PAGE_PERMISSIONS,
  getCurrentUser,
  getCurrentRole,
  isLoggedIn,
  isAdmin,
  checkPageAccess,
  pageGuard,
  checkPermission,
  withPermission,
  clearPermissions,
  setAdminStatus
}
