// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const { api } = require('../../utils/api.js');
const auth = require('../../utils/auth.js');
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
    systemType: 'white',
    themeColor: '#333333',
    tempAvatarUrl: defaultAvatarUrl,
    tempNickName: ''
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

  toAddress() {
    wx.navigateTo({
      url: '/pages/address/address'
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

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  onNicknameInput(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  onNicknameBlur(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  async login() {
    const { tempAvatarUrl, tempNickName } = this.data;
    const defaultAvatar = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

    if (!tempNickName || !tempNickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (tempAvatarUrl === defaultAvatar) {
      wx.showToast({
        title: '请选择头像',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const userInfo = {
        nickName: tempNickName.trim(),
        avatarUrl: tempAvatarUrl
      };

      const loginData = await api.login(userInfo);

      const userInfoWithRole = {
        ...userInfo,
        openid: loginData.openid,
        role: loginData.role || 0,
        isAdmin: loginData.isAdmin || false
      };
      wx.setStorageSync('userInfo', userInfoWithRole);

      this.setData({
        userInfo: userInfoWithRole,
        hasUserInfo: true,
        isAdmin: userInfoWithRole.isAdmin
      });

      app.globalData.userInfo = userInfoWithRole;
      app.globalData.isAdmin = userInfoWithRole.isAdmin;

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
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
