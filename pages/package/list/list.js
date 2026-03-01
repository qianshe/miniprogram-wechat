/**
 * 套餐列表页面
 * 展示白事套餐列表
 */

const packageApi = require('../../../api/package.js');
const { normalizePrice } = require('../../../utils/util.js');
const { SYSTEM_TYPE, CURRENT_SYSTEM_TYPE } = require('../../../config/constants.js');

const PAGE_SIZE = 10;

Page({
  data: {
    // Package list
    packages: [],
    
    // Loading states
    loading: false,
    hasMore: true,
    currentPage: 1,
    
    // Empty state
    isEmpty: false
  },

  onLoad(options) {
    this.loadPackages(true);
  },

  onShow() {
    // Refresh data when page shows
  },

  onPullDownRefresh() {
    this.loadPackages(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPackages(false);
    }
  },

  /**
   * Load packages
   * @param {boolean} isRefresh - Whether to refresh from first page
   */
  async loadPackages(isRefresh = false) {
    if (this.data.loading) return;
    
    const page = isRefresh ? 1 : this.data.currentPage;
    
    this.setData({ loading: true });
    
    try {
      // [殡葬平台转型] 查询 + 渲染双重过滤，只显示白事套餐
      // [殡葬平台转型] 查询过滤：只查询白事套餐
      const result = await packageApi.getList({
        type: CURRENT_SYSTEM_TYPE || SYSTEM_TYPE.WHITE,
        page,
        size: PAGE_SIZE
      });
      
      const { records: list = [], total = 0 } = result || {};
      
      // Format packages for display
      // 使用 normalizePrice 统一处理价格单位
      const formattedPackages = list.map(pkg => {
        const priceInYuan = normalizePrice(pkg.price) || 0;
        const discountPriceInYuan = normalizePrice(pkg.discountPrice);
        return {
          ...pkg,
          price: priceInYuan,
          discountPrice: discountPriceInYuan,
          displayPrice: (discountPriceInYuan || priceInYuan).toFixed(2),
          displayOriginalPrice: priceInYuan.toFixed(2),
          hasDiscount: discountPriceInYuan && discountPriceInYuan < priceInYuan,
          itemCount: pkg.template ? pkg.template.length : 0
        };
      });
      
      const packages = isRefresh ? formattedPackages : [...this.data.packages, ...formattedPackages];
      const hasMore = packages.length < total;
      const isEmpty = packages.length === 0;
      
      this.setData({
        packages,
        hasMore,
        isEmpty,
        currentPage: page + 1,
        loading: false
      });
      
    } catch (err) {
      console.error('Failed to load packages:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * Navigate to package detail
   */
  onPackageClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/package/detail/detail?id=${id}`,
      fail: (err) => {
        console.error('Navigation failed:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * Share configuration
   */
  onShareAppMessage() {
    return {
      title: '精选套餐 - 为您精心搭配',
      path: '/pages/package/list/list'
    };
  }
});