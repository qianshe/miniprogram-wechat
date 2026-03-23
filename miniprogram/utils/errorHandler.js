module.exports = {
  /**
   * 统一错误处理
   * @param {Error} error - 错误对象
   * @param {Object} page - 页面实例
   * @param {Object} options - 配置选项
   */
  handleError(error, page, options = {}) {
    console.error('Error occurred:', error);

    // 错误类型分类
    let errorMessage = '操作失败';
    let errorType = 'unknown';

    // 网络错误处理
    if (error.errMsg && error.errMsg.includes('request:fail')) {
      errorMessage = '网络连接失败，请检查网络设置';
      errorType = 'network';
    }
    // 权限错误处理
    else if (error.code === 403 || (error.errMsg && error.errMsg.includes('permission'))) {
      errorMessage = '没有权限执行此操作';
      errorType = 'permission';
    }
    // 认证错误处理
    else if (error.code === 401 || (error.errMsg && error.errMsg.includes('auth'))) {
      errorMessage = '请先登录';
      errorType = 'auth';
      // 自动跳转到登录页
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        });
      }, 1500);
    }
    // 服务器错误处理
    else if (error.code >= 500) {
      errorMessage = '服务器错误，请稍后重试';
      errorType = 'server';
    }
    // 参数验证错误
    else if (error.code === 400 || (error.message && error.message.includes('参数'))) {
      errorMessage = error.message || '参数错误';
      errorType = 'validation';
    }
    // 业务错误处理
    else if (error.message) {
      errorMessage = error.message;
      errorType = 'business';
    }

    // 根据错误类型显示不同的提示
    const toastOptions = {
      title: errorMessage,
      icon: 'none',
      duration: options.duration || 3000
    };

    // 如果是网络错误，提供重试选项
    if (errorType === 'network' && options.showRetry) {
      wx.showModal({
        title: '网络错误',
        content: errorMessage,
        confirmText: '重试',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm && options.onRetry) {
            options.onRetry();
          }
        }
      });
      return;
    }

    wx.showToast(toastOptions);

    // 如果是严重错误，记录到日志
    if (errorType === 'server' || errorType === 'permission') {
      this.logError(error, errorType);
    }

    return errorType;
  },

  /**
   * 显示加载状态
   * @param {Object} page - 页面实例
   * @param {string} message - 加载提示文字
   */
  showLoading(page, message = '加载中...') {
    if (page && page.setData) {
      page.setData({
        loading: true,
        loadingMessage: message
      });
      wx.showLoading({
        title: message,
        mask: true
      });
    }
  },

  /**
   * 隐藏加载状态
   * @param {Object} page - 页面实例
   */
  hideLoading(page) {
    if (page && page.setData) {
      page.setData({
        loading: false,
        loadingMessage: ''
      });
    }
    wx.hideLoading();
  },

  /**
   * 记录错误日志
   * @param {Error} error - 错误对象
   * @param {string} type - 错误类型
   */
  logError(error, type = 'unknown') {
    const logData = {
      type,
      message: error.message,
      stack: error.stack,
      errMsg: error.errMsg,
      code: error.code,
      timestamp: new Date().toISOString(),
      url: getCurrentPages()[0] ? getCurrentPages()[0].route : 'unknown'
    };

    // 存储到本地，用于后续错误分析
    try {
      const errorLogs = wx.getStorageSync('errorLogs') || [];
      errorLogs.push(logData);

      // 只保留最近100条错误日志
      if (errorLogs.length > 100) {
        errorLogs.shift();
      }

      wx.setStorageSync('errorLogs', errorLogs);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  },

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve({
            online: true,
            networkType: res.networkType
          });
        },
        fail: () => {
          resolve({
            online: false,
            networkType: 'unknown'
          });
        }
      });
    });
  },

  /**
   * 检查网络状态并提示
   */
  async checkNetworkStatus() {
    const status = await this.getNetworkStatus();
    if (!status.online) {
      wx.showToast({
        title: '网络连接已断开',
        icon: 'none',
        duration: 2000
      });
    }
    return status;
  }
};
