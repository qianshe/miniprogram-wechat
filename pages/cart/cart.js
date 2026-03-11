// pages/cart/cart.js
const cartApi = require('../../api/cart.js');
const auth = require('../../utils/auth.js');
const authGuard = require('../../utils/authGuard.js');
const { debounce } = require('../../utils/util.js');
const { buildThumbUrl } = require('../../utils/imageThumb.js');
const { handlePageShow } = require('../../utils/tabbar.js');

const LOCAL_STORAGE_KEY = 'cartListLocal';

Page({
  data: {
    cartItems: [],
    allSelected: false,
    totalAmount: '0.00',
    selectedCount: 0,
    loading: false,
    maxQuantity: 99,
    minQuantity: 1,
    syncLoading: false,
    systemType: 'white',
    startX: 0,
    startY: 0,
    resetTimer: null,
    isLoggedIn: false
  },

  debouncedSyncToCloud: null,

  onLoad() {
    this.debouncedSyncToCloud = debounce(() => this.syncToCloud(), 800);
  },

  onShow() {
    handlePageShow(this, { updateTheme: false, delay: 0 });
    this.setData({ loading: true });
    this.checkLoginAndLoad();
  },

  checkLoginAndLoad() {
    const isLoggedIn = auth.checkAuth();
    this.setData({ isLoggedIn });
    
    if (isLoggedIn) {
      this.loadCartFromCloud();
    } else {
      this.loadCartFromLocal();
    }
  },

  async loadCartFromCloud() {
    try {
      const result = await cartApi.getList();
      const cloudItems = result || [];
      
      const cartItems = cloudItems.map(item => ({
        image: item.image || '/images/default-product.png',
        _id: item._id,
        id: item.productId,
        name: item.name,
        price: item.price,
        thumbSrc: buildThumbUrl(item.image || '/images/default-product.png', { size: 120, quality: 75 }),
        quantity: item.quantity,
        selected: item.selected || false,
        displayPrice: Number(item.price || 0).toFixed(2)
      }));

      this.setData({ cartItems, loading: false }, () => {
        this.updateTotalAmount();
      });
      
      wx.setStorageSync(LOCAL_STORAGE_KEY, cartItems);
    } catch (error) {
      console.error('从云端加载购物车失败:', error);
      this.loadCartFromLocal();
    }
  },

  loadCartFromLocal() {
    const oldCart = wx.getStorageSync('cartList');
    if (oldCart && oldCart.length > 0) {
      const existingCart = wx.getStorageSync(LOCAL_STORAGE_KEY) || [];
      if (existingCart.length === 0) {
        wx.setStorageSync(LOCAL_STORAGE_KEY, oldCart);
        wx.removeStorageSync('cartList');
      }
    }
    
    const localList = wx.getStorageSync(LOCAL_STORAGE_KEY) || [];
    const validList = localList.filter(item =>
      item && item.id && item.name && item.price != null && 
      typeof item.quantity === 'number' && item.quantity > 0
    );

    const cartItems = validList.map(item => ({
      ...item,
      image: item.image || '/images/default-product.png',
      thumbSrc: buildThumbUrl(item.image || '/images/default-product.png', { size: 120, quality: 75 }),
      displayPrice: Number(item.price || 0).toFixed(2),
      selected: item.selected || false
    }));

    this.setData({ cartItems, loading: false }, () => {
      this.updateTotalAmount();
    });
  },

  async syncToCloud() {
    if (!this.data.isLoggedIn) return;
    
    try {
      await cartApi.sync(this.data.cartItems);
    } catch (error) {
      console.error('同步购物车到云端失败:', error);
    }
  },

  saveToLocal() {
    wx.setStorageSync(LOCAL_STORAGE_KEY, this.data.cartItems);
  },

  onCheckboxChange(e) {
    const index = e.currentTarget.dataset.index;
    const selected = e.detail.value.length > 0;
    this.setData({ [`cartItems[${index}].selected`]: selected });
    this.updateTotalAmount();
  },

  toggleSelect(e) {
    const index = e.currentTarget.dataset.index;
    const selected = !this.data.cartItems[index].selected;
    this.setData({ [`cartItems[${index}].selected`]: selected });
    this.updateTotalAmount();
  },

  onSelectAllChange(e) {
    const allSelected = e.detail.value.length > 0;
    const cartItems = this.data.cartItems.map(item => ({ ...item, selected: allSelected }));
    this.setData({ allSelected, cartItems });
    this.updateTotalAmount();
  },

  toggleSelectAll() {
    const allSelected = !this.data.allSelected;
    const cartItems = this.data.cartItems.map(item => ({ ...item, selected: allSelected }));
    this.setData({ allSelected, cartItems });
    this.updateTotalAmount();
  },

  onQuantityChange(e) {
    const index = e.currentTarget.dataset.index;
    const quantity = Number(e.detail.value) || 1;
    this.updateQuantity(index, quantity);
  },

  increaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.cartItems[index];
    if (!item) return;
    if (item.quantity >= this.data.maxQuantity) {
      wx.showToast({ title: `单件最多可选${this.data.maxQuantity}件`, icon: 'none' });
      return;
    }
    this.updateQuantity(index, item.quantity + 1);
  },

  decreaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.cartItems[index];
    if (!item) return;
    if (item.quantity <= this.data.minQuantity) {
      wx.showToast({ title: `至少选择${this.data.minQuantity}件`, icon: 'none' });
      return;
    }
    this.updateQuantity(index, item.quantity - 1);
  },

  updateQuantity(index, quantity) {
    const cartItems = [...this.data.cartItems];
    const item = cartItems[index];
    if (!item) return;

    const safeQuantity = Math.max(this.data.minQuantity, Math.min(quantity, this.data.maxQuantity));
    cartItems[index].quantity = safeQuantity;
    
    this.setData({ cartItems }, () => {
      this.updateTotalAmount();
      this.saveToLocal();
      this.debouncedSyncToCloud();
    });
  },

  deleteItem(e) {
    const { index } = e.currentTarget.dataset;
    const cartItems = [...this.data.cartItems];
    const item = cartItems[index];
    if (!item) return;

    wx.showModal({
      title: '提示',
      content: '确认要删除该商品吗？',
      success: async (res) => {
        if (res.confirm) {
          cartItems.splice(index, 1);
          this.setData({ cartItems }, () => {
            this.updateTotalAmount();
            this.saveToLocal();
            this.debouncedSyncToCloud();
          });
          wx.showToast({ title: '删除成功', icon: 'success' });
        } else {
          this.resetTouchState(index);
        }
      }
    });
  },

  touchStart(e) {
    if (this.data.resetTimer) {
      clearTimeout(this.data.resetTimer);
      this.setData({ resetTimer: null });
    }
    this.setData({
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY
    });
  },

  touchMove(e) {
    const { index } = e.currentTarget.dataset;
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const disX = this.data.startX - moveX;
    const disY = this.data.startY - moveY;

    if (Math.abs(disX) > Math.abs(disY) && disX > 10) {
      const translateX = Math.min(0, -disX);
      const maxTranslate = -150;
      this.setData({
        [`cartItems[${index}].translateX`]: Math.max(maxTranslate, translateX),
        [`cartItems[${index}].isTouchMove`]: true
      });
    }
  },

  touchEnd(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.cartItems[index];
    if (!item) return;

    const translateX = item.translateX || 0;
    if (translateX < -75) {
      this.setData({ [`cartItems[${index}].translateX`]: -150 });
      const timer = setTimeout(() => { this.resetTouchState(index); }, 2000);
      this.setData({ resetTimer: timer });
    } else {
      this.resetTouchState(index);
    }
  },

  resetTouchState(index) {
    if (this.data.resetTimer) {
      clearTimeout(this.data.resetTimer);
      this.setData({ resetTimer: null });
    }
    this.setData({
      [`cartItems[${index}].translateX`]: 0,
      [`cartItems[${index}].isTouchMove`]: false
    });
  },

  updateTotalAmount() {
    const selectedItems = this.data.cartItems.filter(item => item.selected);
    const total = selectedItems.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + (price * quantity);
    }, 0);

    this.setData({
      totalAmount: total.toFixed(2),
      selectedCount: selectedItems.length,
      allSelected: selectedItems.length === this.data.cartItems.length && this.data.cartItems.length > 0
    });
  },

  async checkout() {
    // 统一登录校验
    const isLoggedIn = await authGuard.requireLogin({
      reason: '提交订单需要登录',
      onCancel: 'stay'
    });

    if (!isLoggedIn) {
      return;
    }

    const selectedItems = this.data.cartItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在处理订单' });

    wx.navigateTo({
      url: '../order/confirm/confirm',
      success: (res) => {
        res.eventChannel.emit('acceptDataFromCart', {
          selectedItems,
          totalAmount: this.data.totalAmount
        });
        this.updateTotalAmount();
      },
      fail: () => {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  onHide() {
    this.saveToLocal();
  },

  onUnload() {
    this.debouncedSyncToCloud?.flush?.();
    if (this.data.resetTimer) {
      clearTimeout(this.data.resetTimer);
      this.setData({ resetTimer: null });
    }
    if (this.data.cartItems && this.data.cartItems.length > 0) {
      this.saveToLocal();
    }
  }
});
