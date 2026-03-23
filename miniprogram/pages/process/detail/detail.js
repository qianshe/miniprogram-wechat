const { api, priceToYuan } = require('../../../utils/api.js');

Page({
  data: {
    stepId: '',
    stepInfo: null,
    loading: true,
    isFallbackData: false,
    systemType: 'white', // 默认为白事系统
    themeColor: '#333333', // 默认主题色
    relatedProducts: [], // 相关商品
    productsLoading: true
  },

  onLoad(options) {
    // 获取系统类型和步骤ID
    const systemType = options.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
    const stepId = options.stepId || '';


    this.setData({
      systemType,
      themeColor,
      stepId
    });

    if (stepId) {
      this.loadStepDetail(stepId);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  async loadStepDetail(stepId) {
    try {
      // 获取步骤详情
      const stepDetail = await api.getStepDetail(stepId);

      // 检查步骤详情是否获取成功
      if (!stepDetail) {
        const mockStepInfo = this.getMockStepInfo(stepId);
        this.setData({
          stepInfo: mockStepInfo,
          isFallbackData: true,
          loading: false
        });
        this.loadMockRelatedProducts();
        return;
      }

      const normalizedStepDetail = this.normalizeStepDetail(stepDetail);

      // 如果有关联商品ID，获取商品详情
      let relatedProducts = [];
      if (normalizedStepDetail.productList.length > 0) {
        try {
          // 并行获取所有关联商品的详情
          const productPromises = normalizedStepDetail.productList.map(productId =>
            api.getProductDetail(productId).catch(err => {
              console.warn('[process/detail] Failed to get product detail:', productId, err);
              return null;
            })
          );
          const products = await Promise.all(productPromises);
          relatedProducts = products.filter(product => product !== null);
        } catch (err) {
          console.error('[process/detail] Failed to get related products:', err);
        }
      }

      this.setData({
        stepInfo: normalizedStepDetail,
        relatedProducts,
        isFallbackData: false,
        loading: false,
        productsLoading: false
      });

    } catch (err) {
      console.error('[process/detail] Exception loading step detail:', {
        stepId,
        error: err,
        errorMessage: err.message,
        errorStack: err.stack
      });
      // 加载模拟数据
      const mockStepInfo = this.getMockStepInfo(stepId);
      this.setData({
        stepInfo: mockStepInfo,
        isFallbackData: true,
        loading: false
      });
      this.loadMockRelatedProducts();
    }
  },

  normalizeStepDetail(stepDetail = {}) {
    return {
      ...stepDetail,
      title: stepDetail.title || '',
      description: stepDetail.description || '',
      content: stepDetail.content || '',
      imageUrl: stepDetail.imageUrl || 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: Array.isArray(stepDetail.tips) ? stepDetail.tips : [],
      productList: Array.isArray(stepDetail.productList) ? stepDetail.productList : []
    };
  },
  
  getMockStepInfo(stepId) {
    return {
      id: stepId,
      title: '',
      description: '',
      content: '',
      type: this.data.systemType === 'red' ? 1 : 0,
      order: 0,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    };
  },
  
  loadMockRelatedProducts() {
    // 根据系统类型返回模拟商品数据
    if (this.data.systemType === 'red') {
      // 红事系统模拟商品
      const redProducts = [
        {
          id: 1,
          name: '',
          price: 128800, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        },
        {
          id: 2,
          name: '',
          price: 88800, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        },
        {
          id: 3,
          name: '',
          price: 399900, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        }
      ];
      
      // 转换价格为元
      const products = redProducts.map(item => ({
        ...item,
        price: priceToYuan(item.price)
      }));
      
      this.setData({
        relatedProducts: products,
        productsLoading: false
      });
    } else {
      // 白事系统模拟商品
      const whiteProducts = [
        {
          id: 101,
          name: '',
          price: 38800, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        },
        {
          id: 102,
          name: '',
          price: 68800, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        },
        {
          id: 103,
          name: '',
          price: 299900, // 使用分为单位，保持与后端一致
          imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png'
        }
      ];
      
      // 转换价格为元
      const products = whiteProducts.map(item => ({
        ...item,
        price: priceToYuan(item.price)
      }));
      
      this.setData({
        relatedProducts: products,
        productsLoading: false
      });
    }
  },
  
  onProductClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}&systemType=${this.data.systemType}`,
      fail: (err) => {
        console.error('[process/detail] Navigate to product detail failed:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  }
});
