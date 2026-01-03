const { api } = require('../../../utils/api.js');

Page({
  data: {
    orderNo: '',
    isAdmin: false,
    loading: true,
    originalAmount: '0.00',
    appendAmount: '0.00',
    newTotalAmount: '0.00',
    selectedProducts: [],
    showProductSelector: false,
    searchValue: '',
    filteredProducts: [],
    products: [],
    productsLoading: false,
    productsPagination: {
      page: 1,
      size: 20,
      hasMore: true
    }
  },

  onLoad(options) {
    const orderNo = options.orderNo || '';
    const isAdmin = options.isAdmin === 'true';
    this.setData({ orderNo, isAdmin });
    this.loadOrderInfo();
    this.loadProducts();
  },

  async loadOrderInfo() {
    try {
      const orderData = await api.getOrderDetail(this.data.orderNo, this.data.isAdmin);
      const totalAmount = Number(orderData.totalAmount || 0);
      this.setData({
        originalAmount: totalAmount.toFixed(2),
        newTotalAmount: totalAmount.toFixed(2),
        loading: false
      });
    } catch (err) {
      console.error('加载订单信息失败:', err);
      wx.showToast({ title: '加载订单失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async loadProducts() {
    if (this.data.productsLoading || !this.data.productsPagination.hasMore) return;
    this.setData({ productsLoading: true });
    try {
      const result = await api.getProducts({
        page: this.data.productsPagination.page,
        size: this.data.productsPagination.size,
        keyword: this.data.searchValue,
        status: 1
      });
      const newProducts = result.records || result.list || [];
      const allProducts = [...this.data.products, ...newProducts];
      this.setData({
        products: allProducts,
        filteredProducts: allProducts,
        productsLoading: false,
        'productsPagination.page': this.data.productsPagination.page + 1,
        'productsPagination.hasMore': newProducts.length >= this.data.productsPagination.size
      });
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ productsLoading: false });
    }
  },

  onLoadMoreProducts() {
    this.loadProducts();
  },

  showProductSelector() {
    this.setData({ showProductSelector: true });
  },

  hideProductSelector() {
    this.setData({ showProductSelector: false });
  },

  onPopupChange(e) {
    this.setData({ showProductSelector: e.detail.visible });
  },

  onSearchChange(e) {
    const searchValue = e.detail.value.toLowerCase();
    this.setData({
      searchValue,
      'productsPagination.page': 1,
      'productsPagination.hasMore': true,
      products: [],
      filteredProducts: []
    }, () => {
      this.loadProducts();
    });
  },

  selectProduct(e) {
    const product = e.currentTarget.dataset.product;
    const selectedProducts = [...this.data.selectedProducts];
    const existingIndex = selectedProducts.findIndex(p => p.id === product.id);
    if (existingIndex > -1) {
      selectedProducts[existingIndex].quantity += 1;
    } else {
      selectedProducts.push({ ...product, quantity: 1 });
    }
    this.setData({ selectedProducts });
    this.calculateTotal();
    wx.showToast({ title: '已添加', icon: 'success', duration: 1000 });
  },

  onStepperChange(e) {
    const { index } = e.currentTarget.dataset;
    const value = e.detail.value;
    const selectedProducts = [...this.data.selectedProducts];
    selectedProducts[index].quantity = value;
    this.setData({ selectedProducts });
    this.calculateTotal();
  },

  onSwipeClick(e) {
    const { index } = e.currentTarget.dataset;
    this.removeProduct(index);
  },

  removeProduct(index) {
    const selectedProducts = [...this.data.selectedProducts];
    selectedProducts.splice(index, 1);
    this.setData({ selectedProducts });
    this.calculateTotal();
  },

  calculateTotal() {
    const appendAmount = this.data.selectedProducts.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0
    ) / 100;
    const originalAmount = parseFloat(this.data.originalAmount) || 0;
    const newTotalAmount = originalAmount + appendAmount;
    this.setData({
      appendAmount: appendAmount.toFixed(2),
      newTotalAmount: newTotalAmount.toFixed(2)
    });
  },

  async submitAppend() {
    if (this.data.selectedProducts.length === 0) {
      wx.showToast({ title: '请选择要追加的商品', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      const items = this.data.selectedProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        price: p.price,
        quantity: p.quantity,
        productImage: p.image || p.productImage || ''
      }));
      await api.appendOrderItems(this.data.orderNo, items, this.data.isAdmin);
      wx.hideLoading();
      wx.showToast({ title: '追加成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('追加商品失败:', err);
      wx.showToast({ title: err.message || '追加失败', icon: 'none' });
    }
  }
});
