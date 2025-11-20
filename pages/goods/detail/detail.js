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
      console.log('商品详情:', goods);
      const goodsData = {
        ...goods,
        displayTime: goods.createTime ? new Date(goods.createTime).toLocaleString() : '未知时间',
        image: goods.imageUrl || 'https://tdesign.gtimg.com/mobile/demos/default_goods.png',
        images: goods.imageUrl ? [goods.imageUrl] : ['https://tdesign.gtimg.com/mobile/demos/default_goods.png']
      };

      this.setData({
        goods: goodsData,
        loading: false
      });
    } catch (err) {
      console.error('加载商品详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 修改商品数量
  onQuantityChange(e) {
    const quantity = e.detail.value;
    this.setData({ quantity });
  },



  // 打开SKU弹窗
  showSkuPopup() {
    this.setData({ showSkuPopup: true });
  },

  // 关闭SKU弹窗
  closeSkuPopup() {
    this.setData({
      showSkuPopup: false
    });
  },

  // 数量输入处理
  onQuantityInput(e) {
    let quantity = parseInt(e.detail.value) || 1;
    const maxStock = this.data.goods.stock || 999;

    if (quantity < 1) quantity = 1;
    if (quantity > maxStock) quantity = maxStock;

    this.setData({ quantity });
  },

  // TDesign弹窗状态变化
  onPopupChange(e) {
    this.setData({
      showSkuPopup: e.detail.visible
    });
  },

  // TDesign步进器数量变化
  onQuantityChange(e) {
    this.setData({
      quantity: e.detail.value
    });
  },

  // 加入清单
  addToCart() {
    if (!this.data.goods) return;

    // 检查库存
    if (this.data.quantity > this.data.goods.stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'none'
      });
      return;
    }

    // 获取清单数据
    let cartList = wx.getStorageSync('cartList') || [];

    // 查找是否已存在该商品
    const existingIndex = cartList.findIndex(item => item.id === this.data.goods.id);

    if (existingIndex > -1) {
      // 已存在则更新数量
      cartList[existingIndex].quantity += this.data.quantity;
    } else {
      // 不存在则添加新商品
      cartList.push({
        id: this.data.goods.id,
        name: this.data.goods.name,
        price: this.data.goods.price,
        image: this.data.goods.image,
        quantity: this.data.quantity,
        systemType: this.data.systemType
      });
    }

    // 保存清单数据
    wx.setStorageSync('cartList', cartList);

    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });

    this.closeSkuPopup();
  },

  // 预览图片
  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls: this.data.goods.images
    });
  }
});
