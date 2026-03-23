const assetsConfig = require('../../config/assets.config.js');
const { handlePageShow, handlePageLoad } = require('../../utils/tabbar.js');

Page({
  data: {
    systemType: 'white', // 默认白事
    homeImage: '',
  },

  waitingHomeImagePreload: false,

  onLoad(options) {
    this.applyPreloadedHomeImage();
    // 使用工具函数处理系统类型
    handlePageLoad(this, { updateTheme: false });
  },

  onShow() {
    this.applyPreloadedHomeImage();
    // 使用工具函数处理 TabBar 更新
    handlePageShow(this, { updateTheme: false });
  },

  applyPreloadedHomeImage() {
    const app = getApp();
    const preloadedHomeImage = app.globalData.preloadedImages?.homeImage;
    const preloadStatus = app.globalData.preloadStatus?.homeImage;
    const preloadTask = app.globalData.preloadTasks?.homeImage;

    if (preloadedHomeImage) {
      if (preloadedHomeImage !== this.data.homeImage) {
        this.setData({ homeImage: preloadedHomeImage });
      }
      return;
    }

    if (preloadStatus === 'loading' && preloadTask) {
      if (this.waitingHomeImagePreload) {
        return;
      }

      this.waitingHomeImagePreload = true;

      preloadTask.finally(() => {
        this.waitingHomeImagePreload = false;
        if (this.route !== 'pages/index/index') return;
        const latestImage = app.globalData.preloadedImages?.homeImage || assetsConfig.homeImage;
        if (latestImage !== this.data.homeImage) {
          this.setData({ homeImage: latestImage });
        }
      });
      return;
    }

    if (assetsConfig.homeImage && assetsConfig.homeImage !== this.data.homeImage) {
      this.setData({ homeImage: assetsConfig.homeImage });
    }
  },

  // 一站式套餐
  onTapPackage() {
    // 跳转到套餐列表页
    wx.navigateTo({
      url: '/pages/package/list/list'
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
    wx.switchTab({
      url: '/pages/goods/category/category'
    });
  },

  onPullDownRefresh() {
    this.applyPreloadedHomeImage();
    wx.stopPullDownRefresh();
  }
});
