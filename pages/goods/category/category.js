const { api, priceToYuan } = require('../../../utils/api.js');
const mockData = require('../../../config/mock.js');
const PAGE_SIZE = 15;

Page({
  offsetTopList: [],
  data: {
    sideBarIndex: 0,
    scrollTop: 0,
    categories: [],
    navbarHeight: 0,
    currentPage: 1,
    loading: false
  },

  onLoad() {
    const app = getApp();
    const currentSystemType = app.globalData.systemType || 'white';
    
    this.setData({ 
      systemType: currentSystemType 
    }, () => {
      this.loadCategories();
    });
  },

  onShow() {
    const app = getApp();
    const currentSystemType = app.globalData.systemType || 'white';
    
    if (currentSystemType !== this.data.systemType) {
      this.setData({
        systemType: currentSystemType,
        sideBarIndex: 0,
        scrollTop: 0,
        currentPage: 1,
        categories: []
      }, () => {
        this.loadCategories();
      });
    }
  },

  async loadCategories() {
    try {
      const type = this.data.systemType === 'red' ? 1 : 0;
      const categories = await api.getCategories({ type });
      
      const sortedCategories = categories
        .sort((a, b) => a.sort - b.sort)
        .map(category => ({
          label: category.name,
          title: category.name,
          id: category.id,
          badgeProps: {},
          items: [],
        }));

      this.setData({ 
        categories: sortedCategories,
        loading: false
      }, () => {
        this.loadBatchProducts(0);
      });
    } catch (err) {
      console.error("加载分类失败，使用mock数据:", err);
      
      const mockCategories = (this.data.systemType === 'red' ? 
        mockData.redCategories : 
        mockData.whiteCategories)
        .map(category => ({
          label: category.name,
          title: category.name,
          id: category.id,
          badgeProps: {},
          hasMore: false,
          items: category.products.map(product => {
            const parsedPrice = Number(priceToYuan(product.price) || 0);
            return {
              id: product.id,
              label: product.name,
              image: product.image,
              price: parsedPrice,
              displayPrice: parsedPrice.toFixed(2)
            };
          }),
        }));

      this.setData({ 
        categories: mockCategories,
        loading: false
      });

      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  async loadBatchProducts(categoryIndex) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const category = this.data.categories[categoryIndex];
    try {
      const products = await this.loadCategoryProductsAsync(
        category.id,
        this.data.currentPage,
        PAGE_SIZE
      );

      if (products && products.length > 0) {
        const newCategories = [...this.data.categories];
        newCategories[categoryIndex].items = [
          ...(newCategories[categoryIndex].items || []),
          ...products
        ];        

        this.setData({
          categories: newCategories,
          currentPage: this.data.currentPage + 1,
        });
      }
    } catch (error) {
      console.error('加载商品失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCategoryProductsAsync(categoryId, page = 1, size = PAGE_SIZE) {
    try {
      const result = await api.getProducts({
        page,
        size,
        category: categoryId
      });

      const categoryIndex = this.data.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex !== -1 && this.data.categories[categoryIndex]) {
        const currentItems = this.data.categories[categoryIndex].items || [];
        const hasMore = result.total > currentItems.length + result.records.length;

        const updatedCategories = [...this.data.categories];
        updatedCategories[categoryIndex].hasMore = hasMore;
        this.setData({ categories: updatedCategories });
      }

      return result.records.map(product => {
        const parsedPrice = Number(product.price || 0);
        return {
          id: product._id,
          label: product.name,
          image: product.imageUrl || '/images/default-product.png',
          price: parsedPrice,
          displayPrice: parsedPrice.toFixed(2)
        };
      });
    } catch (err) {
      console.error('加载商品失败:', err);
      return [];
    }
  },

  onSideBarChange(e) {
    const value = e.currentTarget.dataset.value;

    this.setData({
      sideBarIndex: value,
      scrollTop: 0,
      currentPage: 1,
    }, () => {
      this.loadBatchProducts(value);
    });
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    console.log('图片加载失败，使用默认图片:', index);
  },

  onGoodsClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}`,
      fail: (err) => {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      },
    });
  },

  onScrollToLower() {
    if (this.data.categories[this.data.sideBarIndex].hasMore
       && !this.data.loading) {
      this.loadBatchProducts(this.data.sideBarIndex);
    }
  }
});
