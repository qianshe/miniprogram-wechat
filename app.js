// app.js
const cloudConfig = require('./config/cloud.config.js')
const errorHandler = require('./utils/errorHandler.js')

App({

  globalData: {
    systemType: 'white', // 新增系统类型标识
    userInfo: null,
    currentTabIndex: 0,
    isAdmin: false,  // 添加管理员状态标识
    networkStatus: 'unknown', // 网络状态
    apiVersion: '1.0.0' // API版本
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: cloudConfig.envId,
        ...cloudConfig.options
      })
      console.log('云开发初始化成功')
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isAdmin = userInfo.isAdmin || false;
    }

    // 初始化安全环境
    this.setupSecurityEnvironment();

    // 全局错误处理
    this.setupGlobalErrorHandling();

    // 网络状态监控
    this.setupNetworkMonitoring();

    // 检查系统更新
    this.checkForUpdates();
  },

  /**
   * 初始化安全环境
   */
  setupSecurityEnvironment() {
    try {
      const auth = require('./utils/auth.js');
      auth.setupSecurityEnvironment();
      console.log('Security environment initialized');
    } catch (error) {
      console.error('Failed to initialize security environment:', error);
    }
  },

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 监听全局错误
    wx.onError((err) => {
      console.error('Global error:', err);
      errorHandler.logError(err, 'global');
    });

    // 监听未处理的Promise rejection
    wx.onUnhandledRejection((err) => {
      console.error('Unhandled promise rejection:', err);
      errorHandler.logError(err, 'promise');
    });
  },

  /**
   * 设置网络状态监控
   */
  setupNetworkMonitoring() {
    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.globalData.networkStatus = res.networkType;
        console.log('Current network type:', res.networkType);
      }
    });

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      this.globalData.networkStatus = res.networkType;

      if (!res.isConnected) {
        wx.showToast({
          title: '网络连接已断开',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '网络已恢复',
          icon: 'success',
          duration: 1000
        });
      }

      // 保存网络状态历史
      this.saveNetworkStatusHistory(res.isConnected, res.networkType);
    });
  },

  /**
   * 检查系统更新
   */
  checkForUpdates() {
    // 检查小程序版本更新
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        console.log('发现新版本');
      }
    });

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });

    updateManager.onUpdateFailed(() => {
      console.error('新版本下载失败');
    });
  },

  /**
   * 保存网络状态历史
   */
  saveNetworkStatusHistory(isConnected, networkType) {
    try {
      const networkHistory = wx.getStorageSync('networkHistory') || [];
      networkHistory.push({
        timestamp: new Date().toISOString(),
        isConnected,
        networkType
      });

      // 只保留最近1000条记录
      if (networkHistory.length > 1000) {
        networkHistory.shift();
      }

      wx.setStorageSync('networkHistory', networkHistory);
    } catch (err) {
      console.error('Failed to save network history:', err);
    }
  },

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    return this.globalData.networkStatus;
  },

  /**
   * 检查是否在线
   */
  isOnline() {
    return this.globalData.networkStatus !== 'none';
  },

  /**
   * 清理本地缓存
   */
  clearCache() {
    try {
      // 清理图片缓存
      wx.clearStorage();

      // 清理API响应缓存
      const cacheKeys = ['cachedProducts', 'cachedOrders', 'cachedUserInfo'];
      cacheKeys.forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (err) {
          console.warn(`Failed to clear cache ${key}:`, err);
        }
      });

      console.log('Cache cleared successfully');
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  },

  /**
   * 退出登录
   */
  logout() {
    try {
      // 清除用户数据
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      wx.removeStorageSync('isAdmin');

      // 清理清单
      wx.removeStorageSync('cartList');

      // 清除错误日志
      wx.removeStorageSync('errorLogs');

      // 重置全局数据
      this.globalData.userInfo = null;
      this.globalData.isAdmin = false;
      this.globalData.currentTabIndex = 0;

      console.log('User logged out successfully');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
})
