/**
 * 管理端统一权限守卫（admin 分包内）
 * 在管理端页面 onLoad 中调用，校验管理员身份
 */

const auth = require('../../../utils/auth.js')

const checkAdminAccess = () => {
  if (auth.hasValidAdminSession()) {
    return true
  }

  wx.redirectTo({ url: '/pages/admin/login/login' })
  return false
}

module.exports = { checkAdminAccess }
