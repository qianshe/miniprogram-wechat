/**
 * 认证工具类 - 增强安全版本
 * 与 permission.js 权限校验模块集成
 */
const USER_INFO_KEY = 'userInfo';
const SECURITY_KEY = 'auth_security'; // 安全配置键
const LAST_ACTIVE_KEY = 'last_active_time'; // 最后活跃时间

const AUTH_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';
const EXPIRES_KEY = 'auth_expires';

// 引入权限校验模块
const permission = require('./permission');

let _app = null;
const getAppInstance = () => {
  if (!_app) {
    _app = getApp();
  }
  return _app;
};

// 安全配置
const SECURITY_CONFIG = {
  sessionTimeout: 3600, // 会话超时1小时（秒）
  requireReauthAfter: 7200, // 2小时后需要重新认证
  securityStampCheck: true // 安全戳检查
};

module.exports = {
  /**
   * 检查用户是否已登录（云函数简化版）
   */
  checkAuth() {
    try {
      // 在云函数环境下，只需要检查用户信息是否存在
      const userInfo = this.getUserInfo();
      if (!userInfo) return false;

      // 检查会话是否超时
      if (!this.checkSessionTimeout()) {
        this.clearAuth();
        return false;
      }

      // 更新最后活跃时间
      this.updateLastActiveTime();

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  },

  /**
   * 检查管理员会话是否有效（管理员身份 + 会话有效 + 安全戳有效）
   */
  hasValidAdminSession() {
    try {
      if (!this.checkAuth()) return false;

      const userInfo = this.getUserInfo();
      const isAdminByUserInfo = !!userInfo && (userInfo.isAdmin === true || userInfo.role === 1);
      const isAdminByStorage = wx.getStorageSync('isAdmin') === true;

      if (!isAdminByUserInfo && !isAdminByStorage) {
        return false;
      }

      const security = wx.getStorageSync(SECURITY_KEY) || {};
      const hasSecurityStamp = typeof security.securityStamp === 'string' && security.securityStamp.length > 0;

      if (!hasSecurityStamp || !this.validateSecurityStamp()) {
        this.clearAuth();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Admin session check failed:', error);
      return false;
    }
  },


  /**
   * 保存用户信息（云函数简化版）
   */
  setAuth(userInfo) {
    try {
      // 保存用户信息（包含安全信息）
      const secureUserInfo = {
        ...userInfo,
        securityStamp: this.generateSecurityStamp(),
        loginTime: Date.now()
      };

      wx.setStorageSync(USER_INFO_KEY, secureUserInfo);

      // 设置安全环境
      this.setupSecurityEnvironment();

      const app = getAppInstance();
      if (app) {
        app.globalData.userInfo = secureUserInfo;
        app.globalData.isAdmin = userInfo.isAdmin || false;
      }

      // 同步更新权限模块的管理员状态
      permission.setAdminStatus(userInfo.isAdmin || false);

      // 记录认证时间
      wx.setStorageSync('auth_time', Date.now());

    } catch (error) {
      console.error('Failed to set auth data:', error);
      throw error;
    }
  },

  /**
   * 清除用户认证信息
   */
  clearAuth() {
    wx.removeStorageSync(USER_INFO_KEY);

    const app = getAppInstance();
    if (app) {
      app.globalData.userInfo = null;
      app.globalData.isAdmin = false;
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return wx.getStorageSync(USER_INFO_KEY);
  },

  /**
   * 检查是否为管理员
   */
  isAdmin() {
    const userInfo = this.getUserInfo();
    return userInfo && userInfo.isAdmin === true;
  },

  /**
   * 用户登录
   */
  async login(userInfo) {
    try {
      // 调用云函数登录
      const app = getAppInstance();
      const result = await app.globalData.api.login(userInfo);

      // 保存认证信息
      this.setAuth(result.userInfo, result.token, null, 7200);

      return result;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  },

  /**
   * 管理员登录
   */
  async adminLogin(account, password) {
    try {
      // 调用云函数管理员登录
      const app = getAppInstance();
      const result = await app.globalData.api.adminLogin(account, password);

      // 保存管理员认证信息
      this.setAuth(result.userInfo, result.token, null, 7200);

      return result;
    } catch (error) {
      console.error('管理员登录失败:', error);
      throw error;
    }
  },

  /**
   * 检查会话超时
   */
  checkSessionTimeout() {
    const lastActive = wx.getStorageSync(LAST_ACTIVE_KEY);
    if (!lastActive) return true;

    const now = Date.now();
    const sessionTimeout = SECURITY_CONFIG.sessionTimeout * 1000;

    return (now - lastActive) < sessionTimeout;
  },

  /**
   * 检查是否需要重新认证
   */
  requireReauthentication() {
    const authTime = wx.getStorageSync('auth_time');
    if (!authTime) return false;

    const now = Date.now();
    const requireReauthAfter = SECURITY_CONFIG.requireReauthAfter * 1000;

    return (now - authTime) > requireReauthAfter;
  },

  /**
   * 验证安全戳
   */
  validateSecurityStamp() {
    try {
      const security = wx.getStorageSync(SECURITY_KEY) || {};
      const currentStamp = security.securityStamp;

      if (!currentStamp) return true; // 如果没有安全戳，跳过检查

      // 这里可以添加更复杂的安全戳验证逻辑
      // 例如验证设备指纹、IP地址等
      return true;
    } catch (error) {
      console.warn('Security stamp validation failed:', error);
      return false;
    }
  },

  /**
   * 更新最后活跃时间
   */
  updateLastActiveTime() {
    wx.setStorageSync(LAST_ACTIVE_KEY, Date.now());
  },

  /**
   * 生成安全戳
   */
  generateSecurityStamp() {
    const deviceId = this.getDeviceId();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);

    return `${deviceId}_${timestamp}_${random}`;
  },

  /**
   * 获取设备ID（模拟）
   */
  getDeviceId() {
    try {
      let deviceId = wx.getStorageSync('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        wx.setStorageSync('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      return 'unknown_device';
    }
  },

  /**
   * 设置安全环境
   */
  setupSecurityEnvironment() {
    try {
      const security = {
        securityStamp: this.generateSecurityStamp(),
        deviceInfo: this.getDeviceInfo(),
        setupTime: Date.now()
      };

      wx.setStorageSync(SECURITY_KEY, security);
    } catch (error) {
      console.error('Failed to setup security environment:', error);
    }
  },

  /**
   * 获取设备信息
   */
  getDeviceInfo() {
    try {
      return {
        system: wx.getSystemInfoSync().system,
        platform: wx.getSystemInfoSync().platform,
        version: wx.getSystemInfoSync().version,
        screenWidth: wx.getSystemInfoSync().screenWidth,
        screenHeight: wx.getSystemInfoSync().screenHeight,
        pixelRatio: wx.getSystemInfoSync().pixelRatio
      };
    } catch (error) {
      return {};
    }
  },

  /**
   * 检查管理员权限（增强版）
   */
  checkAdminPermission() {
    try {
      const isAdmin = this.isAdmin();
      if (!isAdmin) {
        wx.showToast({
          title: '需要管理员权限',
          icon: 'none'
        });
        return false;
      }

      // 额外的安全检查
      const security = wx.getStorageSync(SECURITY_KEY) || {};
      if (security.securityStamp) {
        // 验证管理员权限的有效性
        const userInfo = this.getUserInfo();
        if (userInfo && userInfo.securityStamp !== security.securityStamp) {
          console.warn('Admin security validation failed');
          wx.showToast({
            title: '权限验证失败，请重新登录',
            icon: 'none'
          });
          this.clearAuth();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Admin permission check failed:', error);
      return false;
    }
  },

  /**
   * 清除认证信息
   */
  clearAuth() {
    try {
      // 清除认证相关存储
      const keysToRemove = [
        'auth_token',
        'refresh_token',
        'auth_expires',
        USER_INFO_KEY,
        LAST_ACTIVE_KEY,
        'auth_time',
        'admin_session'
      ];

      keysToRemove.forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (err) {
          console.warn('Failed to remove storage key ' + key + ':', err);
        }
      });

      const app = getAppInstance();
      if (app) {
        app.globalData.userInfo = null;
        app.globalData.isAdmin = false;
      }
      
      permission.clearPermissions();
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  },

  /**
   * 用户登出
   */
  async logout() {
    try {
      // 清除认证信息
      this.clearAuth();

      // 清除购物车数据（可选）
      wx.removeStorageSync('cartList');
      wx.removeStorageSync('cartListLocal');

      return { success: true };
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    }
  },

  /**
   * 提示用户登录
   */
  loginWithPrompt(callback) {
    wx.showModal({
      title: '提示',
      content: '请先登录以继续使用此功能',
      confirmText: '去登录',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/user/user'
          });
          if (callback) callback(true);
        } else {
          if (callback) callback(false);
        }
      }
    });
  },

  /**
   * 获取权限校验模块
   * 提供对权限模块的访问，用于页面守卫和操作权限检查
   */
  getPermission() {
    return permission;
  },

  /**
   * 检查页面访问权限
   * @param {string} pagePath 页面路径
   * @returns {object} { allowed: boolean, reason?: string, redirect?: string }
   */
  checkPageAccess(pagePath) {
    return permission.checkPageAccess(pagePath);
  },

  /**
   * 页面守卫 - 在页面 onLoad 中调用
   * @param {object} pageInstance 页面实例 (this)
   * @param {object} options 页面参数
   * @returns {boolean} 是否允许访问
   */
  pageGuard(pageInstance, options = {}) {
    return permission.pageGuard(pageInstance, options);
  },

  /**
   * 检查操作权限
   * @param {string} action 操作名称
   * @param {object} resource 资源对象（可选）
   * @returns {boolean}
   */
  checkPermission(action, resource = null) {
    return permission.checkPermission(action, resource);
  },

  /**
   * 权限装饰器 - 用于包装需要权限的函数
   * @param {string} action 操作名称
   * @param {function} fn 原函数
   * @returns {function}
   */
  withPermission(action, fn) {
    return permission.withPermission(action, fn);
  }

};
