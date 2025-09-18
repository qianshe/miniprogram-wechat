// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const auth = require('../../utils/auth.js');
const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
      code: ''
    },
    hasUserInfo: false,
    isAdmin: false,
    systemType: 'white', // 默认为白事系统
    themeColor: '#333333', // 默认主题色
  },
  onLoad() {
    this.checkLoginStatus();
    this.checkUserRole();

    // 获取当前系统类型
    const systemType = app.globalData.systemType || 'white';

    // 根据系统类型设置主题色
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';

    this.setData({
      systemType,
      themeColor
    });
  },

  onShow() {
    // 获取当前系统类型并更新 tabBar
    const systemType = app.globalData.systemType || 'white';

    // 根据系统类型设置主题色
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';

    this.setData({
      systemType,
      themeColor
    });

    // 使用延迟更新 TabBar
    setTimeout(() => {
      if (typeof this.getTabBar === 'function') {
        const tabBar = this.getTabBar();
        if (tabBar && typeof tabBar.updateTabList === 'function') {
          tabBar.updateTabList(systemType);
        }
      }
    }, 100);

    // 检查登录状态
    this.checkLoginStatus();
  },

  toShoppingCart() {
    wx.navigateTo({
      url: '/pages/cart/cart'
    });
  },

  toOrders() {
    wx.navigateTo({
      url: '/pages/order/list/list'
    });
  },

  toFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  toCreateOrder() {
    wx.navigateTo({
      url: '/pages/admin/order/create/create'
    });
  },

  toManagePage() {
    wx.navigateTo({
      url: '/pages/admin/index/index'
    });
  },

  toIndexHome() {
    // 重置app.globalData.index
    app.globalData.currentTabIndex = 0;
    wx.navigateTo({
      url: '/pages/index_home/index_home'
    });
  },

  async login() {
      // 获取用户信息
      const { userInfo } = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: resolve,
          fail: reject
        });
      });

      // 获取微信登录code
      const { code } = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

    try {

      // 调用云函数登录
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          userInfo
        }
      });

      if (loginRes.result.code === 200 && loginRes.result.data) {
        // 保存用户信息（云开发不需要token管理）
        const userInfoWithRole = {
          ...userInfo,
          openid: loginRes.result.data.openid,
          role: loginRes.result.data.role || 0,
          isAdmin: loginRes.result.data.isAdmin || false
        };
        wx.setStorageSync('userInfo', userInfoWithRole);

        // 更新页面状态
        this.setData({
          userInfo: userInfoWithRole,
          hasUserInfo: true,
          isAdmin: userInfoWithRole.isAdmin
        });

        // 更新全局用户信息
        app.globalData.userInfo = userInfoWithRole;
        app.globalData.isAdmin = userInfoWithRole.isAdmin;

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      } else {
        throw new Error(loginRes.result.message || '登录失败');
      }
    } catch (err) {
      console.error('云函数登录失败:', err);

      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
    }

  },

  // 检查登录状态
  checkLoginStatus() {
    // 云开发模式下检查本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      // 更新页面和全局状态
      this.setData({
        userInfo,
        hasUserInfo: true,
        isAdmin: userInfo.isAdmin || false
      });
      app.globalData.userInfo = userInfo;
      app.globalData.isAdmin = userInfo.isAdmin || false;
      return true;
    }

    // 如果token不存在或用户信息不存在，则清除登录状态
    this.setData({
      hasUserInfo: false,
      isAdmin: false,
      userInfo: {
        avatarUrl: defaultAvatarUrl,
        nickName: '',
      }
    });
    app.globalData.isAdmin = false;
    return false;
  },

  // 检查用户角色
  checkUserRole() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'admin') {
      this.setData({
        isAdmin: true
      });
    }
  }
})
