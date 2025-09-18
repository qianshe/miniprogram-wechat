const { api, priceToYuan } = require('../../../utils/api.js');
const mockData = require('../../../config/mock.js');
const PAGE_SIZE = 15; // 每页加载的商品数量


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
    // 获取当前系统类型
    const currentSystemType = app.globalData.systemType || 'white';
    
    this.setData({ 
      systemType: currentSystemType 
    }, () => {
      this.loadCategories();
    });
  },

  onShow() {
    // 添加系统类型检查
    const app = getApp();
    const currentSystemType = app.globalData.systemType || 'white';
    
    // 如果系统类型发生变化，重新加载数据
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
      // data中的systemType是当前组件的系统类型
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
      
      // 修复语法错误
      const mockCategories = (this.data.systemType === 'red' ? 
        mockData.redCategories : 
        mockData.whiteCategories)
        .map(category => ({
          label: category.name,
          title: category.name,
          id: category.id,
          badgeProps: {},
          hasMore: false,
          items: category.products.map(product => ({
            id: product.id,
            label: product.name,
            image: product.image,
            price: priceToYuan(product.price) // 修复括号闭合
          })),
        }));

      this.setData({ 
        categories: mockCategories,
        loading: false
      });

      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 批量加载商品数据
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
        // 追加新商品到当前分类
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

  // 异步加载单个分类的商品
  async loadCategoryProductsAsync(categoryId, page = 1, size = PAGE_SIZE) {
    try {
      const result = await api.getProducts({
        page,
        size,
        category: categoryId
      });

      // 通过分类ID查找对应的分类索引
      const categoryIndex = this.data.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex !== -1 && this.data.categories[categoryIndex]) {
        // 更新hasMore状态
        const currentItems = this.data.categories[categoryIndex].items || [];
        const hasMore = result.total > currentItems.length + result.records.length;

        // 更新分类的hasMore状态
        const updatedCategories = [...this.data.categories];
        updatedCategories[categoryIndex].hasMore = hasMore;
        this.setData({ categories: updatedCategories });
      }

      return result.records.map(product => ({
        id: product._id, // 云数据库使用_id
        label: product.name,
        image: product.imageUrl || '/images/default-product.png',
        price: product.price // api已处理价格转换
      }));
    } catch (err) {
      console.error('加载商品失败:', err);
      return [];
    }
  },

  onSideBarChange(e) {
    const value = e.currentTarget.dataset.value;

    // 切换分类时重置分页状态
    this.setData({
      sideBarIndex: value,
      scrollTop: 0,
      currentPage: 1,
    }, () => {
      // 加载新分类的第一页数据
      this.loadBatchProducts(value);
    });
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    console.log('图片加载失败，使用默认图片:', index);
    // 这里可以设置默认图片
    // 由于微信小程序的限制，我们无法直接修改src，但可以在数据层面处理
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

  // 添加滚动到底部事件处理
  onScrollToLower() {
    if (this.data.categories[this.data.sideBarIndex].hasMore
       && !this.data.loading) {
      this.loadBatchProducts(this.data.sideBarIndex);
    }
  }
});
