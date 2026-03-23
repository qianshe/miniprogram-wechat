/**
 * 统一登录守卫工具
 * 用于需要登录的页面和操作
 */
const auth = require('./auth');

/**
 * Promise 封装的 showModal
 */
function showModalAsync(options) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: resolve,
      fail: () => resolve({ confirm: false, cancel: true })
    });
  });
}

/**
 * 跳转到登录页
 */
function navigateToLogin() {
  // 跳转到用户中心页面（包含登录入口）
  wx.switchTab({
    url: '/pages/user/user'
  });
}

/**
 * 要求用户登录
 * @param {Object} options 配置选项
 * @param {string} options.reason 需要登录的原因说明
 * @param {string} options.onCancel 取消时的行为：'stay'停留当前页 | 'back'返回上一页
 * @returns {Promise<boolean>} 是否已登录
 */
async function requireLogin({ reason = '该操作需要登录后继续', onCancel = 'stay' } = {}) {
  // 检查是否已登录
  if (auth.checkAuth()) {
    return true;
  }

  // 显示登录提示弹窗
  const res = await showModalAsync({
    title: '需要登录',
    content: reason,
    confirmText: '去登录',
    cancelText: '暂不'
  });

  if (res.confirm) {
    // 用户确认去登录
    navigateToLogin();
    return false;
  }

  // 用户取消登录
  if (onCancel === 'back') {
    wx.navigateBack({ delta: 1 });
  }
  return false;
}

module.exports = {
  requireLogin
};
