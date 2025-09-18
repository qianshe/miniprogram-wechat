// app.js
const cloudConfig = require('./config/cloud.config.js')

App({

  globalData: {
    systemType: 'white', // 新增系统类型标识
    userInfo: null,
    currentTabIndex: 0,
    isAdmin: false,  // 添加管理员状态标识
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
  },
})
