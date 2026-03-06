// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const { api } = require('../../utils/api.js');
const auth = require('../../utils/auth.js');
const { handlePageShow, handlePageLoad } = require('../../utils/tabbar.js');
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
    tempNickName: '',
    // 新增：登录流程优化相关状态
    loginStep: 1,        // 当前步骤：1=选择头像，2=设置昵称
    avatarSelected: false, // 是否已选择头像
    nicknameFocus: false,  // 昵称输入框是否聚焦
    canLogin: false,       // 是否可以登录
    loading: false         // 登录中状态
  },
  onLoad() {
    this.checkLoginStatus();
    this.checkUserRole();

    // 使用工具函数处理系统类型和主题色
    handlePageLoad(this);
  },

  onShow() {
    // 使用工具函数处理 TabBar 更新
    handlePageShow(this);

    // 检查登录状态
    this.checkLoginStatus();
  },

  toShoppingCart() {
    wx.switchTab({
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
    wx.navigateTo({
      url: '/pages/index_home/index_home'
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    // 增加空值判断 - 避免把空字符串当成已选头像
    if (!avatarUrl) {
      wx.showToast({
        title: '未获取到头像，请重试',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      tempAvatarUrl: avatarUrl,
      avatarSelected: true,
      loginStep: 2
      // 不自动聚焦昵称输入框，避免授权弹框冲突
    });
    // 更新登录按钮状态
    this.updateCanLogin();
  },

  onNicknameInput(e) {
    this.setData({
      tempNickName: e.detail.value
    });
    // 更新登录按钮状态
    this.updateCanLogin();
  },

  // 处理微信授权昵称填充（bindchange事件）
  onNicknameChange(e) {
    this.setData({
      tempNickName: e.detail.value
    });
    // 更新登录按钮状态
    this.updateCanLogin();
  },

  onNicknameBlur(e) {
    this.setData({
      tempNickName: e.detail.value,
      nicknameFocus: false
    });
    // 更新登录按钮状态
    this.updateCanLogin();
  },

  // 昵称输入确认（键盘完成按钮）- 自动触发登录
  onNicknameConfirm(e) {
    this.setData({
      tempNickName: e.detail.value
    });
    this.updateCanLogin();
    // 如果条件满足，自动登录
    if (this.data.canLogin) {
      this.login();
    }
  },

  // 更新是否可以登录的状态
  updateCanLogin() {
    const { tempAvatarUrl, tempNickName } = this.data;
    const canLogin = this.data.avatarSelected &&
                     tempAvatarUrl !== defaultAvatarUrl &&
                     tempNickName &&
                     tempNickName.trim().length > 0;
    this.setData({ canLogin });
  },

  // 上传头像到云存储，获取永久URL
  async uploadAvatarToCloud(tempFilePath) {
    try {
      // 生成唯一文件名
      const ext = tempFilePath.split('.').pop() || 'png';
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

      // 上传到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      });

      if (!uploadResult.fileID) {
        throw new Error('上传失败，未获取到fileID');
      }

      // 直接返回 fileID，小程序支持直接使用 fileID 作为图片地址
      // 这样可以避免临时URL过期的问题
      return uploadResult.fileID;
    } catch (err) {
      console.error('头像上传失败:', err);
      throw err;
    }
  },

  isCloudFileId(url) {
    if (!url) return false;
    return url.startsWith('cloud://');
  },

  async deleteOldAvatarFromCloud(fileId) {
    if (!fileId || !this.isCloudFileId(fileId)) return;
    
    try {
      await wx.cloud.deleteFile({
        fileList: [fileId]
      });
      console.log('旧头像已删除:', fileId);
    } catch (err) {
      console.warn('删除旧头像失败:', err);
    }
  },

  // 检查是否为临时文件路径
  isTempFilePath(url) {
    if (!url) return false;
    return url.startsWith('wxfile://') ||
           url.startsWith('http://tmp/') ||
           url.startsWith('https://tmp/') ||
           url.includes('tmp_');
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

    if (!tempAvatarUrl || tempAvatarUrl === defaultAvatar) {
      wx.showToast({
        title: '请选择头像',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // 处理头像：如果是临时文件，先上传到云存储获取永久URL
      let finalAvatarUrl = tempAvatarUrl;

      if (this.isTempFilePath(tempAvatarUrl)) {
        const oldAvatarUrl = this.data.userInfo?.avatarUrl;
        
        wx.showLoading({ title: '上传头像中...' });
        try {
          finalAvatarUrl = await this.uploadAvatarToCloud(tempAvatarUrl);
          
          if (oldAvatarUrl && this.isCloudFileId(oldAvatarUrl)) {
            this.deleteOldAvatarFromCloud(oldAvatarUrl);
          }
        } catch (uploadErr) {
          console.error('头像上传失败:', uploadErr);
          wx.hideLoading();
          wx.showToast({
            title: '头像上传失败，请重试',
            icon: 'none'
          });
          this.setData({ loading: false });
          return;
        }
        wx.hideLoading();
      }

      const userInfo = {
        nickName: tempNickName.trim(),
        avatarUrl: finalAvatarUrl
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

  // 检查登录状态（支持从云端自动同步用户数据）
  async checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');

    // 情况1：本地有完整的用户信息，直接使用
    if (userInfo && userInfo.openid && userInfo.nickName && userInfo.avatarUrl) {
      this.setData({
        userInfo,
        hasUserInfo: true,
        isAdmin: userInfo.isAdmin || false
      });
      app.globalData.userInfo = userInfo;
      app.globalData.isAdmin = userInfo.isAdmin || false;
      return true;
    }

    // 情况2：本地没有用户信息，尝试从云端同步
    try {
      const result = await api.checkUser();

      if (result.exists && result.hasCompleteProfile && result.userInfo) {
        // 用户在云端存在且有完整资料，自动同步到本地
        const cloudUserInfo = result.userInfo;
        wx.setStorageSync('userInfo', cloudUserInfo);

        this.setData({
          userInfo: cloudUserInfo,
          hasUserInfo: true,
          isAdmin: cloudUserInfo.isAdmin || false
        });
        app.globalData.userInfo = cloudUserInfo;
        app.globalData.isAdmin = cloudUserInfo.isAdmin || false;

        return true;
      } else {
        // 用户不存在或资料不完整，需要用户设置
        this.setData({
          hasUserInfo: false,
          isAdmin: false,
          userInfo: {
            avatarUrl: defaultAvatarUrl,
            nickName: '',
          },
          loginStep: 1,
          avatarSelected: false,
          canLogin: false
        });
        app.globalData.isAdmin = false;
        return false;
      }
    } catch (err) {
      console.error('云端同步失败:', err);
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
    }
  },

  checkUserRole() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && (userInfo.isAdmin === true || userInfo.role === 'admin' || userInfo.role === 1)) {
      this.setData({
        isAdmin: true
      });
    }
  }
})
