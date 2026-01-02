const { adminApi } = require('../../../../utils/api.js');
const validation = require('../../../../utils/validation.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 产品数据
    productList: [],
    selectedProducts: [],
    searchKeyword: '',
    showProductSelector: false,

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
    // 加载产品列表
    this.loadProducts();
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
   * 加载产品列表
   */
  loadProducts() {
    adminApi.getProducts({ page: 1, size: 100 })
      .then(data => {
        const products = (data.records || []).map(item => ({
          ...item,
          thumb: item.thumb || item.imageUrl || ''
        }));
        this.setData({ productList: products });
      })
      .catch(err => {
        console.error('加载产品失败', err);
        // Fallback to mock
        this.setData({ productList: this.getMockProducts() });
      });
  },

  /**
   * 生成模拟产品数据
   */
  getMockProducts() {
    const products = [];
    for (let i = 1; i <= 20; i++) {
      products.push({
        id: i,
        name: `产品 ${i}`,
        price: Math.floor(Math.random() * 1000) + 100, // 100-1099元
        thumb: 'https://img.yzcdn.cn/vant/cat.jpeg',
        stock: Math.floor(Math.random() * 100) + 10,
        description: `这是产品 ${i} 的详细描述`,
        status: 1 // 1表示上架
      });
    }
    return products;
  },

  /**
   * 打开产品选择器
   */
  openProductSelector() {
    this.setData({
      showProductSelector: true,
      searchKeyword: ''
    });
  },

  /**
   * TDesign弹窗状态变化
   */
  onProductSelectorChange(e) {
    this.setData({
      showProductSelector: e.detail.visible
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
   * 搜索产品
   */
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  /**
   * 选择产品
   */
  selectProduct(e) {
    const { id } = e.currentTarget.dataset;
    const product = this.data.productList.find(item => item.id === id);

    if (!product) return;

    // 检查产品是否已经选择
    const existIndex = this.data.selectedProducts.findIndex(item => item.id === id);

    if (existIndex >= 0) {
      // 已经选择过，增加数量
      const selectedProducts = this.data.selectedProducts.map((item, idx) =>
        idx === existIndex ? { ...item, quantity: item.quantity + 1 } : item
      );

      this.setData({
        selectedProducts
      });
    } else {
      // 新增选择
      const newProduct = {
        ...product,
        quantity: 1
      };

      this.setData({
        selectedProducts: [...this.data.selectedProducts, newProduct]
      });
    }

    this.calculateTotal();
    this.closeProductSelector();
  },

  /**
   * 增加产品数量
   */
  increaseQuantity(e) {
    const { index } = e.currentTarget.dataset;
    const selectedProducts = this.data.selectedProducts.map((item, idx) =>
      idx === index ? { ...item, quantity: item.quantity + 1 } : item
    );

    this.setData({
      selectedProducts
    });

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

      this.setData({
        selectedProducts
      });
      this.calculateTotal();
    } else {
      wx.showModal({
        title: '提示',
        content: '确定要移除此产品吗？',
        success: (res) => {
          if (res.confirm) {
            const selectedProducts = this.data.selectedProducts.filter((_, idx) => idx !== index);
            this.setData({
              selectedProducts
            });
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
    const selectedProducts = this.data.selectedProducts;

    selectedProducts.splice(index, 1);

    this.setData({
      selectedProducts
    });

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
  },

  // 过滤产品列表 - 根据搜索关键词
  getFilteredProducts() {
    const { productList, searchKeyword } = this.data;
    if (!searchKeyword) return productList;

    return productList.filter(product =>
      product.name.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }
});