const { api } = require('../../utils/api.js');
const auth = require('../../utils/auth.js');

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
    resetTimer: null
  },

  onShow() {
    console.log('[页面生命周期] onShow触发，从本地缓存加载购物车');
    this.setData({ loading: true });
    this.loadCartItems();
  },

  async loadCartItems() {
    try {
      // 只从本地缓存加载
      // 数据迁移：将旧的 cartList 迁移到 cartListLocal
      const oldCart = wx.getStorageSync('cartList');
      if (oldCart && oldCart.length > 0) {
        const existingCart = wx.getStorageSync('cartListLocal') || [];
        if (existingCart.length === 0) {
          // 只在 cartListLocal 为空时迁移
          wx.setStorageSync('cartListLocal', oldCart);
          wx.removeStorageSync('cartList'); // 迁移完成后删除旧数据
        }
      }
      const localList = wx.getStorageSync('cartListLocal') || [];
      
      // 过滤掉无效数据（null、undefined、或缺少必要字段的对象）
      const validList = localList.filter(item => 
        item && 
        item.id && 
        item.name && 
        item.price != null && 
        typeof item.quantity === 'number' && 
        item.quantity > 0
      );

      const cartItems = validList.map(item => ({
        ...item,
        displayPrice: Number(item.price || 0).toFixed(2),
        selected: item.selected || false
      }));

      this.setData({
        cartItems,
        loading: false
      }, () => {
        this.updateTotalAmount();
      });
    } catch (error) {
      console.error('加载清单失败:', error);
      this.setData({ loading: false, cartItems: [] });
    }
  },

  onCheckboxChange(e) {
    const index = e.currentTarget.dataset.index;
    const selected = e.detail.value.length > 0;
    this.setData({
      [`cartItems[${index}].selected`]: selected
    });
    this.updateTotalAmount();
  },

  toggleSelect(e) {
    const index = e.currentTarget.dataset.index;
    const selected = !this.data.cartItems[index].selected;
    this.setData({
      [`cartItems[${index}].selected`]: selected
    });
    this.updateTotalAmount();
  },

  onSelectAllChange(e) {
    const allSelected = e.detail.value.length > 0;
    const cartItems = this.data.cartItems.map(item => ({
      ...item,
      selected: allSelected
    }));
    this.setData({
      allSelected,
      cartItems
    });
    this.updateTotalAmount();
  },

  toggleSelectAll() {
    const allSelected = !this.data.allSelected;
    const cartItems = this.data.cartItems.map(item => ({
      ...item,
      selected: allSelected
    }));
    this.setData({
      allSelected,
      cartItems
    });
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
      wx.showToast({
        title: `单件最多可选${this.data.maxQuantity}件`,
        icon: 'none'
      });
      return;
    }
    this.updateQuantity(index, item.quantity + 1);
  },

  decreaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.cartItems[index];
    if (!item) return;
    if (item.quantity <= this.data.minQuantity) {
      wx.showToast({
        title: `至少选择${this.data.minQuantity}件`,
        icon: 'none'
      });
      return;
    }
    this.updateQuantity(index, item.quantity - 1);
  },

  async updateQuantity(index, quantity) {
    const cartItems = [...this.data.cartItems];
    const item = cartItems[index];
    if (!item) return;

    const safeQuantity = Math.max(this.data.minQuantity, Math.min(quantity, this.data.maxQuantity));

    // 直接更新本地数据，不调用API
    cartItems[index].quantity = safeQuantity;
    this.setData({ cartItems }, () => {
      this.updateTotalAmount();
      console.log('[缓存更新] 更新数量后准备更新缓存，商品ID:', item.id, '新数量:', safeQuantity);
      wx.setStorageSync('cartListLocal', this.data.cartItems);
      console.log('[缓存更新] 缓存更新成功');
    });
  },

  async deleteItem(e) {
    const { index } = e.currentTarget.dataset;
    const cartItems = [...this.data.cartItems];
    const item = cartItems[index];
    if (!item) return;

    wx.showModal({
      title: '提示',
      content: '确认要删除该商品吗？',
      success: async (res) => {
        if (res.confirm) {
          // 直接删除本地数据，不调用API
          cartItems.splice(index, 1);
          this.setData({ cartItems }, () => {
            this.updateTotalAmount();
            console.log('[缓存更新] 删除商品后准备更新缓存，剩余商品数:', this.data.cartItems.length);
            wx.setStorageSync('cartListLocal', this.data.cartItems);
            console.log('[缓存更新] 缓存更新成功');
          });

          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
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
      this.setData({
        [`cartItems[${index}].translateX`]: -150
      });
      
      const timer = setTimeout(() => {
        this.resetTouchState(index);
      }, 2000);
      
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

  checkout() {
    if (!auth.checkAuth()) {
      auth.loginWithPrompt();
      return;
    }

    const selectedItems = this.data.cartItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '正在处理订单'
    });

    const remainingItems = this.data.cartItems.filter(item => !item.selected);
    wx.setStorageSync('cartListLocal', remainingItems);

    wx.navigateTo({
      url: '../order/confirm/confirm',
      success: (res) => {
        res.eventChannel.emit('acceptDataFromCart', {
          selectedItems,
          totalAmount: this.data.totalAmount
        });
        this.setData({
          cartItems: remainingItems
        }, () => {
          this.updateTotalAmount();
        });
      },
      fail: () => {
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  handleError(error) {
    console.error('清单操作异常', error);
    wx.showToast({
      title: '操作失败，请稍后重试',
      icon: 'none'
    });
  },

  onHide() {
    console.log('[页面生命周期] onHide触发');
    // 保存购物车数据到本地
    wx.setStorageSync('cartListLocal', this.data.cartItems);
    // 删除这行日志：console.log('[缓存更新] onHide时缓存已更新');
  },

  onUnload() {
    console.log('[页面生命周期] onUnload触发');
    // 卸载时也保存一次
    if (this.data.cartItems && this.data.cartItems.length > 0) {
      wx.setStorageSync('cartListLocal', this.data.cartItems);
      // 删除这行日志：console.log('[缓存更新] onUnload时缓存已更新');
    }
  }
});
