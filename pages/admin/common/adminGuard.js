/**
 * 管理端统一权限守卫（admin 分包内）
 * 在管理端页面 onLoad 中调用，校验管理员身份
 */

const checkAdminAccess = () => {
  const isAdmin = wx.getStorageSync('isAdmin')
  const userInfo = wx.getStorageSync('userInfo')

  if (isAdmin && userInfo && (userInfo.isAdmin === true || userInfo.role === 1)) {
    return true
  }

  wx.redirectTo({ url: '/pages/admin/login/login' })
  return false
}

module.exports = { checkAdminAccess }
