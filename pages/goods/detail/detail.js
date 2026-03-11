const { api } = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const authGuard = require('../../../utils/authGuard.js');
const cartApi = require('../../../api/cart.js');

const DEFAULT_PRODUCT_IMAGE = 'https://tdesign.gtimg.com/mobile/demos/example1.png';

Page({
  data: {
    id: '',
    loading: true,
    goods: null,
    quantity: 1,
    showSkuPopup: false,
    systemType: 'white',
    categoryName: ''
  },

  onLoad(options) {
    const { id, systemType } = options;
    const themeType = systemType || 'white';

    if (id) {
      this.setData({
        id,
        systemType: themeType
      });
      this.loadGoodsDetail(id);
    }
  },

  async resolveCategoryName(goods) {
    const categoryId = goods.category || goods.categoryId || '';
    let resolvedCategoryName = goods.categoryName || '';

    if (!categoryId) {
      return resolvedCategoryName;
    }

    try {
      const categoryDetail = await api.getCategoryDetail(categoryId);
      if (categoryDetail && categoryDetail.name) {
        return categoryDetail.name;
      }

      const categories = await api.getCategories({ page: 1, size: 100, status: 1 });
      const matchedCategory = (categories || []).find((item) => {
        return item && (item._id === categoryId || item.id === categoryId);
      });

      if (matchedCategory && matchedCategory.name) {
        return matchedCategory.name;
      }
    } catch (error) {
      console.warn('[goods/detail] Resolve category failed:', error);
    }

    return resolvedCategoryName;
  },

  async loadGoodsDetail(id) {
    try {
      this.setData({ loading: true });
      wx.showLoading({ title: '加载中' });
      const goods = await api.getProductDetail(id);
      const categoryName = await this.resolveCategoryName(goods);
      const parsedPrice = Number(goods.price || 0);
      const imageCandidates = [
        goods.coverImage,
        ...(Array.isArray(goods.galleryImages) ? goods.galleryImages : []),
        ...(Array.isArray(goods.images) ? goods.images : []),
        goods.thumb,
        goods.imageUrl,
        goods.image
      ].filter(Boolean);
      const normalizedImages = [...new Set(imageCandidates)];
      if (normalizedImages.length === 0) {
        normalizedImages.push(DEFAULT_PRODUCT_IMAGE);
      }
      const goodsData = {
        ...goods,
        price: parsedPrice,
        displayPrice: parsedPrice.toFixed(2),
        displayTime: goods.createTime ? new Date(goods.createTime).toLocaleString() : '',
        image: normalizedImages[0] || DEFAULT_PRODUCT_IMAGE,
        images: normalizedImages
      };

      this.setData({
        goods: goodsData,
        categoryName: categoryName || '',
        loading: false
      });
      wx.hideLoading();
    } catch (err) {
      console.error('[goods/detail] Load goods detail failed:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  showSkuPopup() {
    this.setData({ showSkuPopup: true });
  },

  closeSkuPopup() {
    this.setData({
      showSkuPopup: false
    });
  },

  onPopupChange(e) {
    this.setData({
      showSkuPopup: e.detail.visible
    });
  },

  decreaseQuantity() {
    const next = Math.max(1, this.data.quantity - 1);
    this.setData({ quantity: next });
  },

  increaseQuantity() {
    const maxStock = this.data.goods?.stock || 999;
    const next = Math.min(maxStock, this.data.quantity + 1);
    this.setData({ quantity: next });
  },

  onQuantityChange(e) {
    // 兼容 c-quantity-stepper 组件和 t-stepper 组件
    const value = Number(e.detail.value) || 1;
    const maxStock = this.data.goods?.stock || 999;
    const safeValue = Math.min(Math.max(value, 1), maxStock);
    this.setData({ quantity: safeValue });
  },

  async addToCart() {
    // 统一登录校验
    const isLoggedIn = await authGuard.requireLogin({
      reason: '加入清单需要登录',
      onCancel: 'stay'
    });

    if (!isLoggedIn) {
      return;
    }

    if (!this.data.goods) return;

    if (this.data.quantity > this.data.goods.stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'none'
      });
      return;
    }

    let cartList = wx.getStorageSync('cartListLocal') || [];
    const targetId = this.data.goods._id || this.data.goods.id;
    const existingIndex = cartList.findIndex(item => item.id === targetId);

    if (existingIndex > -1) {
      cartList[existingIndex].quantity += this.data.quantity;
    } else {
      cartList.push({
        id: targetId,
        name: this.data.goods.name,
        price: this.data.goods.price,
        image: this.data.goods.image,
        quantity: this.data.quantity,
        systemType: this.data.systemType
      });
    }

    wx.setStorageSync('cartListLocal', cartList);

    // 云端同步 (仅登录用户)
    if (isLoggedIn) {
      const syncData = {
        productId: targetId,
        name: this.data.goods.name,
        price: this.data.goods.price,
        image: this.data.goods.image || '',
        quantity: this.data.quantity,
        systemType: this.data.systemType
      };

      // 验证必需字段 - 使用更严格的空字符串检查
      if (!syncData.productId || syncData.productId === '' ||
          !syncData.name || syncData.name === '' ||
          syncData.price === undefined || syncData.price === null) {
        console.warn('[addToCart] Cloud sync skipped - missing required fields:', {
          hasProductId: !!syncData.productId,
          hasName: !!syncData.name,
          hasPrice: syncData.price !== undefined
        });
      } else {
        cartApi.add(syncData).then(() => {
          console.log('[addToCart] Cloud sync success');
        }).catch(err => {
          console.error('Cart cloud sync failed:', err);
        });
      }
    }

    wx.showToast({
      title: '加入成功',
      icon: 'success'
    });

    this.closeSkuPopup();
  },

  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls: this.data.goods.images
    });
  }
});
