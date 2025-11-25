const { api, priceToYuan } = require('../../utils/api.js');
const mockData = require('../../config/mock.js');

Page({
  data: {
    systemType: 'white', // 默认白事
  },

  onLoad(options) {
    const app = getApp();
    const systemType = app.globalData.systemType || 'white';

    this.setData({
      systemType,
    });
  },

  onShow() {
    const app = getApp();
    const systemType = app.globalData.systemType || 'white';

    this.setData({
      systemType,
    });

    // 更新TabBar
    this.updateTabBar(systemType);
  },

  updateTabBar(systemType) {
    setTimeout(() => {
      if (typeof this.getTabBar === 'function') {
        const tabBar = this.getTabBar();
        if (tabBar?.updateTabList) {
          tabBar.updateTabList(systemType);
        }
      }
    }, 100);
  },

  // 一站式套装
  onTapPackage() {
    // 跳转到商品分类页，并可能需要传递特定参数显示套装
    wx.switchTab({
      url: '/pages/goods/category/category'
    });
  },

  // 治丧指南
  onTapGuide() {
    // 跳转到治丧指南流程列表页
    wx.navigateTo({
      url: '/pages/process/list/list'
    });
  },

  // 专业服务项
  onTapService() {
    // 跳转到服务项目列表，可能是商品分类下的服务类目
    wx.switchTab({
      url: '/pages/goods/category/category'
    });
  }
});
