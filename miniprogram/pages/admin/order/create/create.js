const { adminApi, api } = require('../../../../utils/api.js');
const validation = require('../../utils/validation.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');
const packageApi = require('../../../../api/package.js');
const { normalizePrice } = require('../../../../utils/util.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 产品数据
    productList: [],
    selectedProducts: [],
    showProductSelector: false,

    // 套餐数据
    packageList: [],
    packageLoading: false,
    selectedPackageId: '',
    selectedPackageName: '',
    selectedPackagePrice: 0,
    selectedPackageDescription: '',
    packageImporting: false,
    createMode: '',
    
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

    // 服务记录数据
    formData: {
      contactName: '',
      contactPhone: '',
      serviceTime: '',
      address: null
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
    if (!checkAdminAccess()) return
    const mode = (options.mode || '').toLowerCase();
    if (mode !== 'package' && mode !== 'free') {
      this.redirectToEntry('请先选择创建方式');
      return;
    }

    if (mode === 'package') {
      const packageId = options.packageId;
      if (!packageId) {
        this.redirectToEntry('请选择服务套餐');
        return;
      }
      this.setData({
        createMode: 'package',
        selectedPackageId: packageId
      });
    } else {
      this.setData({
        createMode: 'free',
        selectedPackageId: '',
        selectedPackageName: '',
        selectedPackagePrice: 0,
        selectedPackageDescription: ''
      });
    }
    // 设置默认服务时间（明天）
    this.setDefaultServiceTime();
    // 加载分类列表
    this.loadCategories();

    if (mode === 'package') {
      this.importPackageById(options.packageId);
    }
  },

  redirectToEntry(message) {
    if (message) {
      wx.showToast({ title: message, icon: 'none', duration: 1500 });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/admin/order/create-entry/create-entry' });
      }, 600);
      return;
    }
    wx.redirectTo({ url: '/pages/admin/order/create-entry/create-entry' });
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
   * 加载套餐列表
   */
  async loadPackages() {
    this.setData({ packageLoading: true });

    try {
      const result = await packageApi.adminGetList({
        page: 1,
        size: 50,
        type: 'white',
        status: 1
      }, { showLoading: false });

      const records = result?.records || result?.list || [];
      const packageList = records.map(pkg => ({
        ...pkg,
        id: pkg._id || pkg.id,
        name: pkg.name || '未命名套餐',
        description: pkg.description || '',
        price: normalizePrice(pkg.price) || 0,
        imageUrl: pkg.imageUrl || ''
      }));

      this.setData({ packageList, packageLoading: false });
    } catch (err) {
      console.error('加载套餐失败:', err);
      this.setData({ packageList: [], packageLoading: false });
    }
  },

  /**
   * 选择套餐并导入模板
   */
  onSelectPackage(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const doImport = () => {
      this.importPackageById(id);
    };

    if (this.data.selectedProducts.length > 0) {
      wx.showModal({
        title: '确认导入',
        content: '导入套餐将覆盖当前已编辑的服务内容，是否继续？',
        confirmText: '继续导入',
        cancelText: '暂不导入',
        success: (res) => {
          if (res.confirm) {
            doImport();
          }
        }
      });
      return;
    }

    doImport();
  },

  /**
   * 导入套餐模板
   */
  async importPackageById(packageId) {
    if (this.data.packageImporting) return;

    this.setData({ packageImporting: true });

    try {
      const packageInfo = await packageApi.adminGetDetail({ id: packageId }, { showLoading: true, loadingText: '导入中...' });
      const normalizedTemplate = this.normalizePackageTemplate(packageInfo?.template || []);
      const selectedProducts = this.flattenTemplateProducts(normalizedTemplate);
      const selectedPackagePrice = normalizePrice(packageInfo?.price) || 0;
      const selectedPackageDescription = packageInfo?.description || '';

      if (!selectedProducts.length) {
        wx.showToast({ title: '套餐内暂无服务内容', icon: 'none' });
      }

      const filteredProducts = this.updateFilteredProductsSelection(this.data.filteredProducts, selectedProducts);

      this.setData({
        selectedPackageId: packageId,
        selectedPackageName: packageInfo?.name || '',
        selectedPackagePrice,
        selectedPackageDescription,
        selectedProducts,
        filteredProducts
      });
      this.calculateTotal();

      wx.showToast({ title: '已导入套餐', icon: 'success', duration: 1200 });
    } catch (err) {
      console.error('导入套餐失败:', err);
      wx.showToast({ title: err.message || '导入套餐失败', icon: 'none' });
    } finally {
      this.setData({ packageImporting: false });
    }
  },

  /**
   * 标准化套餐模板，兼容新旧格式
   */
  normalizePackageTemplate(template) {
    if (!template || !Array.isArray(template)) return [];

    return template.map(item => {
      if (item.products && Array.isArray(item.products)) {
        return {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          products: item.products.map(product => ({
            productId: product.productId,
            productName: product.productName || product.name || '',
            price: product.price || 0,
            quantity: product.quantity || 1,
            imageUrl: product.imageUrl || product.thumb || ''
          }))
        };
      }

      const products = [];
      if (item.defaultProductId || item.selectedProduct) {
        const selectedProduct = item.selectedProduct || {};
        products.push({
          productId: item.defaultProductId || selectedProduct._id || selectedProduct.id || '',
          productName: selectedProduct.name || item.defaultProductName || '',
          price: selectedProduct.price || 0,
          quantity: item.quantity || 1,
          imageUrl: selectedProduct.imageUrl || selectedProduct.thumb || ''
        });
      }

      return {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        products
      };
    });
  },

  /**
   * 扁平化模板商品为可编辑快照
   */
  flattenTemplateProducts(templateItems) {
    const productMap = new Map();

    (templateItems || []).forEach(category => {
      (category.products || []).forEach(product => {
        const productId = product.productId || product._id || product.id;
        if (!productId) return;

        const quantity = Math.max(1, Number(product.quantity) || 1);
        const price = normalizePrice(product.price) || 0;
        const existing = productMap.get(productId);

        if (existing) {
          existing.quantity += quantity;
          return;
        }

        productMap.set(productId, {
          id: productId,
          productId,
          name: product.productName || product.name || '',
          price,
          quantity,
          thumb: product.imageUrl || product.thumb || ''
        });
      });
    });

    return Array.from(productMap.values());
  },

  /**
   * 打开产品选择器
   */
  openProductSelector() {
    if (this.data.createMode === 'package' && !this.data.selectedPackageId) {
      wx.showToast({ title: '请先选择服务套餐', icon: 'none' });
      return;
    }

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
   * 选择服务内容（来自组件事件）
   */
  onProductSelect(e) {
    const product = e.detail.product;
    const productId = product.id;

    if (!productId) {
      wx.showToast({ title: '服务内容数据异常', icon: 'none' });
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
      serviceTime: {
        required: true,
        label: '服务时间'
      }
    };

    if (formData.contactName) {
      validationRules.contactName = {
        required: false,
        label: '联系人姓名',
        type: 'string',
        minLength: 2,
        maxLength: 20
      };
    }

    if (formData.contactPhone) {
      validationRules.contactPhone = {
        required: false,
        label: '联系电话',
        type: 'phone'
      };
    }

    if (formData.address) {
      validationRules.address = {
        required: false,
        label: '服务地址',
        type: 'string',
        minLength: 5,
        maxLength: 200
      };
    }

    const formValidation = validation.validateForm(formData, validationRules);
    const errors = formValidation.errors;

    // 验证商品列表
    if (selectedProducts.length === 0) {
      errors.products = '请至少选择一项服务内容';
    }

    this.setData({ errors });

    return Object.keys(errors).length === 0;
  },

   /**
    * 创建服务记录
    */
  submitOrder() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请完善服务记录信息',
        icon: 'none',
        duration: 3000
      });
      return;
    }

    if (this.data.isSubmitting) return;

    this.setData({
      isSubmitting: true
    });

    const { formData, selectedProducts, totalAmount, createMode, selectedPackageId, selectedPackageName } = this.data;

    // 构建服务记录数据
    const orderData = {
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      serviceTime: formData.serviceTime,
      address: formData.address || null,
      remark: '',
      totalAmount,
      items: selectedProducts.map(product => ({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: product.quantity,
        subtotal: product.price * product.quantity,
        productImage: product.productImage || product.coverImage || product.thumb || product.imageUrl || product.image || ''
      })),
      // 标记为管理员创建，等待用户绑定
      waitForBind: true
    };

    if (createMode === 'package' && selectedPackageId && selectedPackageName) {
      orderData.sourcePackageId = selectedPackageId;
      orderData.sourcePackageName = selectedPackageName;
    }

    // 使用统一的服务记录校验
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

    // 调用云函数创建服务记录
    wx.showLoading({
      title: '创建服务记录中...'
    });

    // 调用统一API创建服务记录
    adminApi.createOrder(orderData)
      .then(data => {
        wx.hideLoading();

        const { orderNo } = data;

        // 成功反馈
        wx.showToast({
          title: '服务记录创建成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          // 跳转到二维码展示页面
          wx.navigateTo({
            url: `/pages/admin/order/qr-code/qr-code?orderNo=${orderNo}`
          });
        }, 1000);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: err.message || '创建服务记录失败',
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