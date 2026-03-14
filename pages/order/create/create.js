const { api } = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const authGuard = require('../../../utils/authGuard.js');
const validation = require('../utils/validation.js');

Page({
  data: {
    customerName: '',
    phone: '',
    selectedProducts: [],
    totalAmount: '0.00',
    showProductSelector: false,
    searchValue: '',
    filteredProducts: [],
    products: [], // 商品列表
    recording: false,
    debugText: '', // 添加调试文本字段
    productsLoading: false,
    productsPagination: {
      page: 1,
      size: 20,
      hasMore: true
    }
  },

  onCustomerNameChange(e) {
    const customerName = e.detail.value;
    this.setData({ customerName }, () => {
      this.validateField('customerName', customerName);
    });
  },

  onPhoneChange(e) {
    const phone = e.detail.value;
    this.setData({ phone }, () => {
      this.validateField('phone', phone);
    });
  },

  // 隐藏商品选择器
  hideProductSelector() {
    this.setData({ showProductSelector: false })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  showProductSelector() {
    this.setData({ showProductSelector: true })
  },

  // TDesign弹窗状态变化
  onPopupChange(e) {
    this.setData({ showProductSelector: e.detail.visible })
  },

  onSearchChange(e) {
    const searchValue = e.detail.value.toLowerCase()
    // 重置分页
    this.setData({
      searchValue,
      'productsPagination.page': 1,
      products: [],
      filteredProducts: []
    }, () => {
      this.loadProducts();
    });
  },

  selectProduct(e) {
    const product = e.currentTarget.dataset.product
    const selectedProducts = [...this.data.selectedProducts]
    const existingIndex = selectedProducts.findIndex(p => p.id === product.id)
    
    if (existingIndex > -1) {
      selectedProducts[existingIndex].quantity += 1
    } else {
      selectedProducts.push({ ...product, quantity: 1 })
    }
    
    this.setData({ selectedProducts })
    this.calculateTotal()
  },

  startVoiceInput() {
    wx.showToast({
      title: '语音识别功能开发中...',
      icon: 'none',
      duration: 2000
    })
  },

  stopVoiceInput() {
    // 空函数保留接口
  },

  searchAndAddProduct(productName) {
    const product = this.data.products.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase())
    )
    if (product) {
      this.selectProduct({ currentTarget: { dataset: { product } } })
      wx.showToast({ title: '已添加商品' })
    } else {
      wx.showToast({ title: '未找到相关商品', icon: 'none' })
    }
  },

  increaseQuantity(e) {
    const { index } = e.currentTarget.dataset
    const selectedProducts = [...this.data.selectedProducts]
    selectedProducts[index].quantity += 1
    this.setData({ selectedProducts })
    this.calculateTotal()
  },

  decreaseQuantity(e) {
    const { index } = e.currentTarget.dataset
    const selectedProducts = [...this.data.selectedProducts]
    if (selectedProducts[index].quantity > 1) {
      selectedProducts[index].quantity -= 1
      this.setData({ selectedProducts })
      this.calculateTotal()
    }
  },

  removeProduct(e) {
    const { index } = e.currentTarget.dataset
    const selectedProducts = [...this.data.selectedProducts]
    selectedProducts.splice(index, 1)
    this.setData({ selectedProducts })
    this.calculateTotal()
  },

  calculateTotal() {
    const total = this.data.selectedProducts.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    )
    this.setData({ totalAmount: total.toFixed(2) })
  },

  async createOrder() {
    const validationRules = {
      customerName: {
        required: true,
        label: '联系人姓名',
        type: 'string',
        minLength: 2,
        maxLength: 20
      },
      phone: {
        required: true,
        label: '联系电话',
        type: 'phone'
      }
    };

    const formData = {
      customerName: this.data.customerName,
      phone: this.data.phone
    };

    const validationResult = validation.validateForm(formData, validationRules);

    if (!validationResult.valid) {
      const errorMessage = Object.values(validationResult.errors)[0];
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 验证商品列表
    if (!this.data.selectedProducts || this.data.selectedProducts.length === 0) {
      wx.showToast({
        title: '请至少选择一件商品',
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 统一登录校验
    const isLoggedIn = await authGuard.requireLogin({
      reason: '创建订单需要登录',
      onCancel: 'stay'
    });

    if (!isLoggedIn) {
      return;
    }

    try {
      wx.showLoading({ title: '正在创建订单' });

      const orderData = {
        contactName: this.data.customerName,
        contactPhone: this.data.phone,
        items: this.data.selectedProducts.map(p => ({
          productId: p.id,
          productName: p.name,
          price: p.price,
          quantity: p.quantity,
          productImage: p.image || ''
        })),
        totalAmount: this.data.totalAmount,
        remark: this.data.remark || ''
      };

      // 使用统一的订单验证
      const orderValidation = validation.validateOrderData(orderData);
      if (!orderValidation.valid) {
        wx.hideLoading();
        wx.showToast({
          title: orderValidation.errors[0],
          icon: 'none',
          duration: 3000
        });
        return;
      }

      // 调用统一API创建订单
      const data = await api.createOrder(orderData);

      // 获取订单号和二维码链接
      const { orderNo, qrCodeUrl } = data;

      wx.hideLoading();

      // 成功反馈
      wx.showToast({
        title: '订单创建成功',
        icon: 'success',
        duration: 2000
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        // 跳转到订单详情页，并传递订单信息
        wx.navigateTo({
          url: `/pages/order/detail/detail?orderNo=${orderNo}`
        });
      }, 1000);
    } catch (error) {
      console.error('创建订单失败:', error);
      wx.showToast({
        title: error.message || error.result?.message || '订单创建失败',
        icon: 'none',
        duration: 3000
      });
    } finally {
      wx.hideLoading();
    }
  },

  copyDebugText() {
    wx.setClipboardData({
      data: this.data.debugText,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  appendDebug(text) {
    this.setData({
      debugText: this.data.debugText + text + '\n'
    })
  },

  onLoad(options) {
    this.loadProducts();
  },

  // 加载商品列表
  async loadProducts(isLoadMore = false) {
    if (this.data.productsLoading) return;
    
    try {
      this.setData({ productsLoading: true });
      const { page, size } = this.data.productsPagination;

      const res = await api.getProducts({
        page,
        size,
        // 如果有搜索关键词，添加搜索参数
        ...(this.data.searchValue ? { keyword: this.data.searchValue } : {})
      });

      if (res.code === 200 && res.data) {
        const formattedProducts = res.data.records.map(product => ({
          id: product.id,
          name: product.name,
          price: (product.price / 100).toFixed(2),
          stock: product.stock,
          image: product.imageUrl || ''
        }));

        this.setData({
          products: isLoadMore ? [...this.data.products, ...formattedProducts] : formattedProducts,
          filteredProducts: isLoadMore ? [...this.data.filteredProducts, ...formattedProducts] : formattedProducts,
          'productsPagination.hasMore': res.data.total > page * size,
          productsLoading: false
        });
      }
    } catch (err) {
      console.error('加载商品列表失败:', err);
      wx.showToast({
        title: '加载商品失败',
        icon: 'none'
      });
    } finally {
      this.setData({ productsLoading: false });
    }
  },

  // 加载更多商品
  onLoadMoreProducts() {
    if (this.data.productsPagination.hasMore && !this.data.productsLoading) {
      this.setData({
        'productsPagination.page': this.data.productsPagination.page + 1
      }, () => {
        this.loadProducts(true);
      });
    }
  },

  onReady() {

  },

  onShow() {

  },

  onHide() {

  },

  onUnload() {

  },

  onPullDownRefresh() {

  },

  onReachBottom() {

  },

  onShareAppMessage() {

  },

  /**
   * 验证单个字段
   */
  validateField(fieldName, value) {
    const fieldValidations = {
      customerName: validation.validateUsername(value, 2, 20),
      phone: validation.validatePhone(value)
    };

    const fieldValidation = fieldValidations[fieldName];
    if (fieldValidation && !fieldValidation.valid) {
      this.setData({
        [`${fieldName}Error`]: fieldValidation.message
      });
    } else {
      this.setData({
        [`${fieldName}Error`]: ''
      });
    }
  },

  /**
   * 清除字段错误
   */
  clearFieldError(fieldName) {
    this.setData({
      [`${fieldName}Error`]: ''
    });
  }
})
