// app.js
const cloudConfig = require('./config/cloud.config.js')
const errorHandler = require('./utils/errorHandler.js')
const assetsConfig = require('./config/assets.config.js')

App({

  globalData: {
    systemType: 'white', // 新增系统类型标识
    userInfo: null,
    currentTabIndex: 0,
    isAdmin: false,  // 添加管理员状态标识
    networkStatus: 'unknown', // 网络状态
    apiVersion: '1.0.0', // API版本
    preloadedImages: {},
    preloadTasks: {},
    preloadStatus: {
      homeImage: 'idle'
    }
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
    }

    // [殡葬平台转型] 全局冻结为 WHITE 类型，拦截所有红事路由
    const launchOptions = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
    const launchPath = (launchOptions.path || '').toLowerCase();
    const launchType = String((launchOptions.query && launchOptions.query.type) || '').toLowerCase();
    // [殡葬平台转型] 检测 URL 参数 type=red 或路径包含 red 时，统一回白事首页
    if (launchType === 'red' || launchPath.includes('red')) {
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
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

    // 预加载首页核心图片
    this.preloadCoreImages();
  },

  /**
   * 预加载首页核心图片
   */
  preloadCoreImages() {
    const imageMap = {
      homeImage: assetsConfig.homeImage
    }

    Object.keys(imageMap).forEach((key) => {
      const src = imageMap[key]
      if (!src) {
        return
      }

      this.globalData.preloadStatus[key] = 'loading'

      this.globalData.preloadTasks[key] = new Promise((resolve) => {
        wx.getImageInfo({
          src,
          success: (res) => {
            this.globalData.preloadedImages[key] = res.path || src
            this.globalData.preloadStatus[key] = 'success'
            resolve(this.globalData.preloadedImages[key])
          },
          fail: () => {
            // 失败时保留原图地址兜底，避免影响页面展示
            this.globalData.preloadedImages[key] = src
            this.globalData.preloadStatus[key] = 'failed'
            resolve(src)
          }
        })
      })
    })
  },

  /**
   * 初始化安全环境
   */
  setupSecurityEnvironment() {
    try {
      const auth = require('./utils/auth.js');
      auth.setupSecurityEnvironment();
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
    });
  },

  /**
   * 检查系统更新
   */
  checkForUpdates() {
    // 检查小程序版本更新
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      // 静默检查更新
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
   * 退出登录
   */
  logout() {
    try {
      // 清除用户数据
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      wx.removeStorageSync('isAdmin');

      // 清除错误日志
      wx.removeStorageSync('errorLogs');

      // 重置全局数据
      this.globalData.userInfo = null;
      this.globalData.isAdmin = false;
      this.globalData.currentTabIndex = 0;
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
})
