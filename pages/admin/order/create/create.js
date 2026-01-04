const { adminApi, api } = require('../../../../utils/api.js');
const validation = require('../../../../utils/validation.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 产品数据
    productList: [],
    selectedProducts: [],
    showProductSelector: false,
    
    // 分类和分页数据
    categories: [],
    currentCategoryIndex: 0,
    currentCategoryId: '',
    filteredProducts: [],
    productsLoading: false,
    productsPagination: {
      page: 1,
      size: 20,
      hasMore: true
    },

    // 订单数据
    formData: {
      contactName: '',
      contactPhone: '',
      serviceTime: '',
      address: '',
      remark: ''
    },

    // 计算数据
    totalAmount: 0,

    // 页面状态
    isSubmitting: false,
    errors: {},
    fieldErrors: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 设置默认服务时间（明天）
    this.setDefaultServiceTime();
    // 加载分类列表
    this.loadCategories();
  },

  /**
   * 设置默认服务时间
   */
  setDefaultServiceTime() {
    // 设置默认服务时间为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const day = tomorrow.getDate().toString().padStart(2, '0');

    this.setData({
      'formData.serviceTime': `${year}-${month}-${day}`
    });
  },

  /**
   * 加载分类列表
   */
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

  /**
   * 加载产品列表
   */
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
        id: p._id || p.id,
        thumb: p.thumb || p.imageUrl || ''
      }));
      const allProducts = isRefresh ? newProducts : [...this.data.productList, ...newProducts];
      const filteredProducts = this.updateFilteredProductsSelection(allProducts, this.data.selectedProducts);
      this.setData({
        productList: allProducts,
        filteredProducts: filteredProducts,
        productsLoading: false,
        'productsPagination.page': page + 1,
        'productsPagination.hasMore': newProducts.length >= this.data.productsPagination.size
      });
    } catch (err) {
      console.error('加载产品失败:', err);
      this.setData({ productsLoading: false });
    }
  },

  /**
   * 打开产品选择器
   */
  openProductSelector() {
    const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, this.data.selectedProducts);
    this.setData({
      showProductSelector: true,
      filteredProducts
    });
  },

  /**
   * 关闭产品选择器
   */
  closeProductSelector() {
    this.setData({
      showProductSelector: false
    });
  },

  /**
   * 分类切换
   */
  onCategoryChange(e) {
    const index = e.detail.index;
    if (index === this.data.currentCategoryIndex) return;
    const category = this.data.categories[index];
    this.setData({
      currentCategoryIndex: index,
      currentCategoryId: category.id,
      productList: [],
      filteredProducts: [],
      'productsPagination.page': 1,
      'productsPagination.hasMore': true
    }, () => {
      this.loadProducts(true);
    });
  },

  /**
   * 加载更多产品
   */
  onLoadMoreProducts() {
    this.loadProducts();
  },

  /**
   * 选择产品（来自组件事件）
   */
  onProductSelect(e) {
    const product = e.detail.product;
    const productId = product.id;

    if (!productId) {
      wx.showToast({ title: '商品数据异常', icon: 'none' });
      return;
    }

    const selectedProducts = [...this.data.selectedProducts];
    const existingIndex = selectedProducts.findIndex(p => String(p.id) === String(productId));

    if (existingIndex > -1) {
      selectedProducts[existingIndex].quantity += 1;
    } else {
      selectedProducts.push({ ...product, quantity: 1 });
    }

    const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);
    this.setData({ selectedProducts, filteredProducts });
    this.calculateTotal();
    wx.showToast({ title: '已添加', icon: 'success', duration: 1000 });
  },

  /**
   * 更新 filteredProducts 中的选中状态
   */
  updateFilteredProductsSelection(products, selectedProducts) {
    return products.map(p => {
      const selected = selectedProducts.find(sp => String(sp.id) === String(p.id));
      return {
        ...p,
        _isSelected: !!selected,
        _selectedQuantity: selected ? selected.quantity : 0
      };
    });
  },

  /**
   * 增加产品数量
   */
  increaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const selectedProducts = this.data.selectedProducts.map((item, idx) =>
      idx === index ? { ...item, quantity: item.quantity + 1 } : item
    );

    const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);
    this.setData({ selectedProducts, filteredProducts });
    this.calculateTotal();
  },

  /**
   * 减少产品数量
   */
  decreaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const currentProduct = this.data.selectedProducts[index];

    if (currentProduct.quantity > 1) {
      const selectedProducts = this.data.selectedProducts.map((item, idx) =>
        idx === index ? { ...item, quantity: item.quantity - 1 } : item
      );

      const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);
      this.setData({ selectedProducts, filteredProducts });
      this.calculateTotal();
    } else {
      wx.showModal({
        title: '提示',
        content: '确定要移除此产品吗？',
        success: (res) => {
          if (res.confirm) {
            const selectedProducts = this.data.selectedProducts.filter((_, idx) => idx !== index);
            const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);
            this.setData({ selectedProducts, filteredProducts });
            this.calculateTotal();
          }
        }
      });
    }
  },

  /**
   * 移除产品
   */
  removeProduct(e) {
    const { index } = e.currentTarget.dataset;
    const selectedProducts = [...this.data.selectedProducts];
    selectedProducts.splice(index, 1);

    const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);
    this.setData({ selectedProducts, filteredProducts });
    this.calculateTotal();
  },

  /**
   * 计算总金额
   */
  calculateTotal() {
    let total = 0;
    this.data.selectedProducts.forEach(product => {
      total += product.price * product.quantity;
    });

    this.setData({
      totalAmount: total
    });
  },

  /**
   * 服务时间变化
   */
  onServiceTimeChange(e) {
    this.setData({
      'formData.serviceTime': e.detail.value,
      'errors.serviceTime': ''
    });
  },

  /**
   * TDesign输入框变化
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: ''
    });
  },

  /**
   * 表单输入变化 (保留兼容)
   */
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: ''
    }, () => {
      this.validateField(field, value);
    });
  },

  /**
   * 验证表单
   */
  validateForm() {
    const { formData, selectedProducts } = this.data;

    const validationRules = {
      contactName: {
        required: true,
        label: '联系人姓名',
        type: 'string',
        minLength: 2,
        maxLength: 20
      },
      contactPhone: {
        required: true,
        label: '联系电话',
        type: 'phone'
      },
      serviceTime: {
        required: true,
        label: '服务时间'
      },
      address: {
        required: true,
        label: '服务地址',
        type: 'string',
        minLength: 5,
        maxLength: 200
      }
    };

    const formValidation = validation.validateForm(formData, validationRules);
    const errors = formValidation.errors;

    // 验证商品列表
    if (selectedProducts.length === 0) {
      errors.products = '请至少选择一个产品';
    }

    this.setData({ errors });

    return Object.keys(errors).length === 0;
  },

  /**
   * 提交订单
   */
  submitOrder() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请完善订单信息',
        icon: 'none',
        duration: 3000
      });
      return;
    }

    if (this.data.isSubmitting) return;

    this.setData({
      isSubmitting: true
    });

    const { formData, selectedProducts, totalAmount } = this.data;

    // 构建订单数据
    const orderData = {
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      serviceTime: formData.serviceTime,
      address: formData.address,
      remark: formData.remark || '',
      totalAmount,
      items: selectedProducts.map(product => ({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: product.quantity,
        subtotal: product.price * product.quantity
      })),
      // 标记为管理员创建，等待用户绑定
      waitForBind: true
    };

    // 使用统一的订单验证
    const orderValidation = validation.validateOrderData(orderData);
    if (!orderValidation.valid) {
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: orderValidation.errors[0],
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 调用云函数创建订单
    wx.showLoading({
      title: '创建订单中...'
    });

    // 调用统一API创建订单
    adminApi.createOrder(orderData)
      .then(data => {
        wx.hideLoading();

        const { orderNo, qrCodeUrl } = data;

        // 成功反馈
        wx.showToast({
          title: '订单创建成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          // 跳转到二维码展示页面
          wx.navigateTo({
            url: `/pages/admin/order/qr-code/qr-code?orderNo=${orderNo}&qrCodeUrl=${encodeURIComponent(qrCodeUrl)}`
          });
        }, 1000);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: err.message || '创建订单失败',
          icon: 'none',
          duration: 3000
        });
      })
      .finally(() => {
        this.setData({
          isSubmitting: false
        });
      });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});