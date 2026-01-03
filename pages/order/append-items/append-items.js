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
    },
    categories: [],
    currentCategoryIndex: 0,
    currentCategoryId: '',
    isPageContainerSupported: true
  },

  onLoad(options) {
    const { SDKVersion } = wx.getSystemInfoSync();
    const compareVersion = (v1, v2) => {
      const s1 = v1.split('.').map(Number);
      const s2 = v2.split('.').map(Number);
      const len = Math.max(s1.length, s2.length);
      for (let i = 0; i < len; i++) {
        const n1 = s1[i] || 0;
        const n2 = s2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
      }
      return 0;
    };
    this.setData({ isPageContainerSupported: compareVersion(SDKVersion, '2.16.0') >= 0 });
    const orderNo = options.orderNo || '';
    const isAdmin = options.isAdmin === 'true';
    this.setData({ orderNo, isAdmin });
    this.loadOrderInfo();
    this.loadCategories();
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

  async loadCategories() {
    try {
      const app = getApp();
      const type = app.globalData.systemType || 'white';
      const categories = await api.getCategories({ type });
      const sortedCategories = categories
        .sort((a, b) => a.sort - b.sort)
        .map(category => ({
          name: category.name,
          id: category._id
        }));
      const allCategory = { id: '', name: '全部' };
      const categoriesWithAll = [allCategory, ...sortedCategories];
      this.setData({
        categories: categoriesWithAll,
        currentCategoryIndex: 0,
        currentCategoryId: ''
      }, () => {
        this.loadProducts(true);
      });
    } catch (err) {
      console.error('加载分类失败:', err);
      this.loadProducts(true);
    }
  },

  async loadProducts(isRefresh = false) {
    if (this.data.productsLoading) return;
    if (!isRefresh && !this.data.productsPagination.hasMore) return;
    
    this.setData({ productsLoading: true });
    const page = isRefresh ? 1 : this.data.productsPagination.page;
    
    try {
      const params = {
        page,
        size: this.data.productsPagination.size,
        status: 1
      };
      if (this.data.currentCategoryId) {
        params.category = this.data.currentCategoryId;
      }
      const result = await api.getProducts(params);
      const rawProducts = result.records || result.list || [];
      const newProducts = rawProducts.map(p => ({
        ...p,
        id: p._id || p.id
      }));
      const allProducts = isRefresh ? newProducts : [...this.data.products, ...newProducts];
      this.setData({
        products: allProducts,
        filteredProducts: allProducts,
        productsLoading: false,
        'productsPagination.page': page + 1,
        'productsPagination.hasMore': newProducts.length >= this.data.productsPagination.size
      });
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ productsLoading: false });
    }
  },

  onCategoryChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.currentCategoryIndex) return;
    const category = this.data.categories[index];
    this.setData({
      currentCategoryIndex: index,
      currentCategoryId: category.id,
      products: [],
      filteredProducts: [],
      'productsPagination.page': 1,
      'productsPagination.hasMore': true
    }, () => {
      this.loadProducts(true);
    });
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

  preventTouchMove() {
    return false;
  },

  stopPropagation() {
    // 阻止事件冒泡
  },



  selectProduct(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0 || index >= this.data.filteredProducts.length) {
      return;
    }
    const product = this.data.filteredProducts[index];
    const productId = product.id;
    if (!productId) {
      wx.showToast({ title: '商品数据异常', icon: 'none' });
      return;
    }
    const selectedProducts = [...this.data.selectedProducts];
    const existingIndex = selectedProducts.findIndex(p => p.id === productId);
    if (existingIndex > -1) {
      selectedProducts[existingIndex].quantity += 1;
    } else {
      selectedProducts.push({ ...product, quantity: 1 });
    }
    this.setData({ selectedProducts });
    this.calculateTotal();
    wx.showToast({ title: '已添加', icon: 'success', duration: 1000 });
  },

  onQuantityMinus(e) {
    const { index } = e.currentTarget.dataset;
    const selectedProducts = [...this.data.selectedProducts];
    if (selectedProducts[index].quantity > 1) {
      selectedProducts[index].quantity -= 1;
      this.setData({ selectedProducts });
      this.calculateTotal();
    }
  },

  onQuantityPlus(e) {
    const { index } = e.currentTarget.dataset;
    const selectedProducts = [...this.data.selectedProducts];
    if (selectedProducts[index].quantity < 99) {
      selectedProducts[index].quantity += 1;
      this.setData({ selectedProducts });
      this.calculateTotal();
    }
  },

  onDeleteProduct(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要移除这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          this.removeProduct(index);
        }
      }
    });
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
        productImage: p.imageUrl || p.image || p.productImage || ''
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
