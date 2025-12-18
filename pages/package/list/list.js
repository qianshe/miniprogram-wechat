/**
 * 套餐列表页面
 * 展示白事套餐列表
 */

const PAGE_SIZE = 10;

// Mock data for development (仅保留白事套餐)
// 默认图片路径
const DEFAULT_PACKAGE_IMAGE = 'https://tdesign.gtimg.com/mobile/demos/example1.png';

const MOCK_PACKAGES = [
  {
    _id: 'pkg_white_001',
    name: '基础套餐',
    description: '适合简单仪式，包含基本殡葬用品',
    type: 'white',
    price: 299900,
    discountPrice: 259900,
    imageUrl: DEFAULT_PACKAGE_IMAGE,
    status: 1,
    sort: 1,
    template: [
      { categoryId: 'cat_001', categoryName: '花圈', quantity: 2, defaultProductId: 'prod_001' },
      { categoryId: 'cat_002', categoryName: '骨灰盒', quantity: 1, defaultProductId: 'prod_010' }
    ]
  },
  {
    _id: 'pkg_white_002',
    name: '标准套餐',
    description: '适合中等规模仪式，包含完整殡葬用品',
    type: 'white',
    price: 599900,
    discountPrice: 499900,
    imageUrl: DEFAULT_PACKAGE_IMAGE,
    status: 1,
    sort: 2,
    template: [
      { categoryId: 'cat_001', categoryName: '花圈', quantity: 4, defaultProductId: 'prod_001' },
      { categoryId: 'cat_002', categoryName: '骨灰盒', quantity: 1, defaultProductId: 'prod_011' },
      { categoryId: 'cat_003', categoryName: '寿衣', quantity: 1, defaultProductId: 'prod_020' }
    ]
  },
  {
    _id: 'pkg_white_003',
    name: '豪华套餐',
    description: '适合大型仪式，包含高端殡葬用品及服务',
    type: 'white',
    price: 999900,
    discountPrice: 899900,
    imageUrl: DEFAULT_PACKAGE_IMAGE,
    status: 1,
    sort: 3,
    template: [
      { categoryId: 'cat_001', categoryName: '花圈', quantity: 8, defaultProductId: 'prod_002' },
      { categoryId: 'cat_002', categoryName: '骨灰盒', quantity: 1, defaultProductId: 'prod_012' },
      { categoryId: 'cat_003', categoryName: '寿衣', quantity: 1, defaultProductId: 'prod_021' },
      { categoryId: 'cat_004', categoryName: '灵堂布置', quantity: 1, defaultProductId: 'prod_030' }
    ]
  }
];

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
      // TODO: Replace with actual API call when cloud function is ready
      // const result = await packageApi.getList({
      //   type: 'white', // 固定查询白事套餐
      //   page,
      //   size: PAGE_SIZE
      // });
      
      // Using mock data for now
      await this.simulateApiCall();
      
      const mockData = MOCK_PACKAGES;
      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const newPackages = mockData.slice(startIndex, endIndex);
      
      // Format packages for display
      const formattedPackages = newPackages.map(pkg => ({
        ...pkg,
        displayPrice: (pkg.discountPrice / 100).toFixed(2),
        displayOriginalPrice: (pkg.price / 100).toFixed(2),
        hasDiscount: pkg.discountPrice < pkg.price,
        itemCount: pkg.template ? pkg.template.length : 0
      }));
      
      const packages = isRefresh ? formattedPackages : [...this.data.packages, ...formattedPackages];
      const hasMore = endIndex < mockData.length;
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
   * Simulate API call delay
   */
  simulateApiCall() {
    return new Promise(resolve => {
      setTimeout(resolve, 300);
    });
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