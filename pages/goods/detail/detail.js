const { api } = require('../../../utils/api.js');

Page({
  data: {
    id: '',
    loading: true,
    goods: null,
    quantity: 1,
    showSkuPopup: false,
    systemType: 'white'
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

  async loadGoodsDetail(id) {
    try {
      this.setData({ loading: true });
      const goods = await api.getProductDetail(id);
      const parsedPrice = Number(goods.price || 0);
      const goodsData = {
        ...goods,
        price: parsedPrice,
        displayPrice: parsedPrice.toFixed(2),
        displayTime: goods.createTime ? new Date(goods.createTime).toLocaleString() : '未知时间',
        image: goods.imageUrl || 'https://tdesign.gtimg.com/mobile/demos/default_goods.png',
        images: goods.imageUrl ? [goods.imageUrl] : ['https://tdesign.gtimg.com/mobile/demos/default_goods.png']
      };

      this.setData({
        goods: goodsData,
        loading: false
      });
    } catch (err) {
      console.error('获取商品详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
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
    const value = Number(e.detail.value) || 1;
    const maxStock = this.data.goods?.stock || 999;
    const safeValue = Math.min(Math.max(value, 1), maxStock);
    this.setData({ quantity: safeValue });
  },

  addToCart() {
    if (!this.data.goods) return;

    if (this.data.quantity > this.data.goods.stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'none'
      });
      return;
    }

    let cartList = wx.getStorageSync('cartListLocal') || [];
    const targetId = this.data.goods.id || this.data.goods._id;
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
