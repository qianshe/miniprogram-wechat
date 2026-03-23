// pages/index_home/index_home.js
const assetsConfig = require('../../config/assets.config.js')

Page({
  data: {
    isAnimating: false,
    homeImageUrl: assetsConfig.homePageBanner
  },

  onTapOpen() {
    if (this.data.isAnimating) return;

    this.setData({ isAnimating: true });

    // Wait for animation to finish (or mostly finish) before navigating
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }, 1000); // Navigate after 1s
  },

  onShow() {
    // Reset state when returning
    this.setData({ isAnimating: false });
  }
})