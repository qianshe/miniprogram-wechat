const { api, priceToYuan } = require('../../utils/api.js');
const mockData = require('../../config/mock.js');

Page({
  data: {
    systemType: 'white', // 默认白事
    themeColor: '#333333',
    processSteps: [],
    loading: true,
    swiperList: [],
    current: 1,
    autoplay: true,
    duration: 500,
    interval: 5000,
    recommendedProducts: [],
    productsLoading: true
  },

  onLoad(options) {
    const app = getApp();
    // 获取系统类型
    const systemType = app.globalData.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
    
    this.setData({ 
      systemType,
      themeColor
    });

    // 初始化数据
    this.initSwiperList();
    this.loadProcessSteps();
    this.loadRecommendProducts();
  },

  onShow() {
    const app = getApp();
    // 从URL参数或全局状态获取系统类型
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const systemType = currentPage.options.systemType || app.globalData.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
    
    // 更新页面和全局状态
    this.setData({ 
      systemType,
      themeColor
    }, () => {
      // 重新加载数据
      this.loadProcessSteps();
      this.loadRecommendProducts();
    });
    
    app.globalData.systemType = systemType;
    app.globalData.currentTabIndex = 0;
    
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

  initSwiperList() {
    const imageCdn = 'https://tdesign.gtimg.com/mobile/demos';
    const swiperList = [{
      value: `${imageCdn}/swiper1.png`,
      ariaLabel: '图片1',
    }, {
      value: `${imageCdn}/swiper2.png`,
      ariaLabel: '图片2',
    }];

    this.setData({ swiperList });
  },

  async loadProcessSteps() {
    try {
      const steps = await api.getProcessSteps({
        type: this.data.systemType === 'red' ? 1 : 0
      });



      this.setData({
        processSteps: steps || [],
        loading: false
      });
    } catch (err) {
      console.error('获取流程数据失败:', err);
      // 根据系统类型加载对应的模拟数据
      const mockSteps = this.data.systemType === 'red' ? mockData.redSteps : mockData.whiteSteps;



      this.setData({
        processSteps: mockSteps,
        loading: false
      });
    }
  },

  async loadRecommendProducts() {
    try {
      const products = await api.getRecommendProducts({ 
        type: this.data.systemType === 'red' ? 1 : 0 
      });
      this.setData({
        recommendedProducts: products || [],
        productsLoading: false
      });
    } catch (err) {
      console.error('获取推荐商品失败:', err);
      // 根据系统类型加载对应的模拟数据
      const mockProducts = this.data.systemType === 'red' ? 
        mockData.redProducts : mockData.whiteProducts;

      // 修复价格处理逻辑
      const formattedProducts = mockProducts.map(item => ({
        ...item,
        price: priceToYuan(item.price) // 使用解构引入的 priceToYuan
      }));
      
      this.setData({ 
        recommendedProducts: formattedProducts,
        productsLoading: false 
      });
    }
  },

  getMockRedSteps() {
    return mockData.redSteps;
  },

  getMockWhiteSteps() {
    return mockData.whiteSteps;
  },

  onProductClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}&systemType=${this.data.systemType}`,
    });
  },

  onStepClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/process/detail/detail?stepId=${id}&systemType=${this.data.systemType}`,
    });
  }
});
