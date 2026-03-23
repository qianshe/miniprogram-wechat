const { api } = require('../../../utils/api.js');
const { buildThumbUrl } = require('../../../utils/imageThumb.js');
const { handlePageShow } = require('../../../utils/tabbar.js');
const PAGE_SIZE = 15;

Page({
  data: {
    sideBarIndex: 0,
    scrollTop: 0,
    categories: [],
    products: [],
    currentCategory: null,
    hasMore: true,
    currentPage: 1,
    loading: false,
    navbarHeight: 0
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
        categories: [],
        products: [],
        currentCategory: null,
        hasMore: true
      }, () => {
        this.loadCategories();
      });
    }

    handlePageShow(this, { updateTheme: false, delay: 0 });
  },

  async loadCategories() {
    try {
      const type = this.data.systemType || 'white';
      const categories = await api.getCategories({ type });
      
      const sortedCategories = categories
        .sort((a, b) => a.sort - b.sort)
        .map(category => ({
          label: category.name,
          title: category.name,
          id: category._id
        }));

      const allCategory = { id: '', label: '全部', title: '全部' };
      const categoriesWithAll = [allCategory, ...sortedCategories];

      this.setData({
        categories: categoriesWithAll,
        currentCategory: allCategory,
        sideBarIndex: 0
      }, () => {
        this.loadProducts(true);
      });
    } catch (err) {
      console.error("加载分类失败:", err);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
      this.setData({
        categories: [],
        products: [],
        loading: false
      });
    }
  },

  async loadProducts(isRefresh = false) {
    if (this.data.loading) return;
    if (!this.data.currentCategory) return;

    const page = isRefresh ? 1 : this.data.currentPage;
    
    this.setData({ loading: true });

    try {
      const params = {
        page,
        size: PAGE_SIZE
      };
      
      if (this.data.currentCategory.id) {
        params.category = this.data.currentCategory.id;
      }
      
      const result = await api.getProducts(params);

      const newProducts = result.records.map(product => {
        const parsedPrice = Number(product.price || 0);
        const coverImage = product.coverImage || product.thumb || product.imageUrl || product.image || '/images/default-product.png';

        return {
          id: product._id || product.id,
          label: product.name,
          image: coverImage,
          thumbSrc: buildThumbUrl(coverImage, { size: 200, quality: 75 }),
          price: parsedPrice,
          displayPrice: parsedPrice.toFixed(2)
        };
      });

      const products = isRefresh ? newProducts : [...this.data.products, ...newProducts];
      const hasMore = result.total > products.length;

      this.setData({
        products,
        hasMore,
        currentPage: page + 1,
        loading: false
      });
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ loading: false });
    }
  },

  onSideBarChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.sideBarIndex) return;

    const category = this.data.categories[index];
    
    this.setData({
      sideBarIndex: index,
      currentCategory: category,
      products: [],
      hasMore: true,
      currentPage: 1,
      scrollTop: 0
    }, () => {
      this.loadProducts(true);
    });
  },

  onImageError(e) {
    // 图片加载失败，静默处理
  },

  onGoodsClick(e) {
    const { id } = e.currentTarget.dataset;
    const categoryName = this.data.currentCategory ? this.data.currentCategory.label : '';
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}&categoryName=${encodeURIComponent(categoryName)}`,
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
    if (this.data.hasMore && !this.data.loading) {
      this.loadProducts(false);
    }
  }
});
