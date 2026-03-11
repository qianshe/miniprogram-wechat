/**
 * 套餐详情/定制页面
 * 展示套餐信息，支持商品替换和数量调整
 * 支持多商品数据结构
 */

const packageApi = require('../../../api/package.js');
const productApi = require('../../../api/product.js');
const { normalizePrice } = require('../../../utils/util.js');
const auth = require('../../../utils/auth.js');
const { requireLogin } = require('../../../utils/authGuard.js');

const SWIPE_DELETE_WIDTH = 150;
const SWIPE_OPEN_THRESHOLD = SWIPE_DELETE_WIDTH / 2;

// 默认图片路径
const DEFAULT_PACKAGE_IMAGE = 'https://tdesign.gtimg.com/mobile/demos/example1.png';
const DEFAULT_PRODUCT_IMAGE = 'https://tdesign.gtimg.com/mobile/demos/example1.png';

/**
 * 标准化模板数据，兼容旧格式
 * 旧格式：单商品 { defaultProductId, selectedProduct, quantity }
 * 新格式：多商品 { products: [{ productId, productName, price, quantity, imageUrl }] }
 */
function normalizeTemplate(template) {
  if (!template || !Array.isArray(template)) return [];

  return template.map(item => {
    // 新格式：已有 products 数组
    if (item.products && Array.isArray(item.products)) {
      return {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        products: item.products.map(p => ({
          productId: p.productId,
          productName: p.productName || '',
          price: p.price || 0,
          quantity: p.quantity || 1,
          imageUrl: p.imageUrl || DEFAULT_PRODUCT_IMAGE
        }))
      };
    }

    // 旧格式：转换为新格式
    const products = [];
    if (item.defaultProductId || item.selectedProduct) {
      const selectedProduct = item.selectedProduct || {};
      products.push({
        productId: item.defaultProductId || selectedProduct._id || '',
        productName: selectedProduct.name || item.defaultProductName || '',
        price: selectedProduct.price || 0,
        quantity: item.quantity || 1,
        imageUrl: selectedProduct.imageUrl || DEFAULT_PRODUCT_IMAGE
      });
    }

    return {
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      products: products
    };
  });
}

Page({
  data: {
    // Package data
    packageId: '',
    packageInfo: null,

    // Customization items - 新结构：每个分类包含 products 数组
    items: [],

    // Price calculation
    totalPrice: 0,
    originalPrice: 0,
    savedAmount: 0,

    // Loading states
    loading: true,
    submitting: false,

    // Product Replacer Popup
    showReplacer: false,
    loadingProducts: false,
    currentItem: null,           // 当前分类
    currentItemIndex: -1,        // 当前分类索引
    currentProductIndex: -1,     // 当前商品在 products 数组中的索引
    currentCategoryName: '',
    availableProducts: [],
    selectedProductId: '',

    // Swipe delete state
    swipeStartX: 0,
    swipeStartY: 0,
    swipeStartTranslateX: 0,
    swipeActiveRowKey: '',
    swipeOpenRowKey: '',

    // 性能优化：低端设备禁用毛玻璃效果
    enableBlur: true
  },

  /**
   * 重新计算分类与商品展示字段
   * @param {Object} category 分类项
   * @returns {Object}
   */
  rebuildCategoryPricing(category) {
    const products = (category.products || []).map(product => {
      const price = normalizePrice(product.price) || 0;
      const quantity = Math.max(1, Number(product.quantity) || 1);
      const subtotal = price * quantity;

      return {
        ...product,
        price,
        quantity,
        displayPrice: price.toFixed(2),
        subtotal,
        displaySubtotal: subtotal.toFixed(2)
      };
    });

    const categorySubtotal = products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);

    const isCustomized = products.some(product => product.isCustomized);

    return {
      ...category,
      products,
      isCustomized,
      categorySubtotal,
      displayCategorySubtotal: categorySubtotal.toFixed(2)
    };
  },

  /**
   * 统一刷新 items 与价格摘要
   * @param {Array} items 分类数组
   */
  syncItemsAndPrices(items) {
    const normalizedItems = (items || []).map(category => this.rebuildCategoryPricing(category));
    const priceInfo = this.calculatePrices(normalizedItems);

    this.setData({
      items: normalizedItems,
      ...priceInfo
    });
  },

  /**
   * 判断商品是否在当前套餐中重复
   * @param {string} productId 商品ID
   * @param {Object} exclude 排除位置
   * @returns {boolean}
   */
  isDuplicateProductId(productId, exclude = {}) {
    if (!productId) return false;

    const {
      categoryIndex: excludeCategoryIndex = -1,
      productIndex: excludeProductIndex = -1
    } = exclude;

    const isDuplicate = (this.data.items || []).some((category, categoryIndex) => {
      return (category.products || []).some((product, productIndex) => {
        if (categoryIndex === excludeCategoryIndex && productIndex === excludeProductIndex) {
          return false;
        }
        return product.productId === productId;
      });
    });

    return isDuplicate;
  },

  /**
   * 打开替换商品弹窗（支持替换/补位）
   */
  openProductReplacer({ categoryIndex, productIndex, categoryId, categoryName }) {
    this.closeOpenedSwipeRow();

    const currentItem = this.data.items[categoryIndex];
    const currentProduct = productIndex >= 0 ? currentItem.products[productIndex] : null;

    this.setData({
      showReplacer: true,
      currentItem,
      currentItemIndex: categoryIndex,
      currentProductIndex: productIndex,
      currentCategoryName: categoryName,
      selectedProductId: currentProduct ? currentProduct.productId : '',
      availableProducts: [],
      loadingProducts: true
    });

    this.fetchProductsByCategory(categoryId, currentProduct);
  },

  onLoad(options) {
    // 检测设备性能，低端设备禁用毛玻璃效果
    this.checkDevicePerformance();
    if (options.id) {
      this.setData({ packageId: options.id });
      this.loadPackageDetail(options.id);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * Prevent background scroll when popup is open
   */
  preventTouchMove() {
    // Do nothing
  },

  /**
   * Load package detail
   */
  async loadPackageDetail(id) {
    this.setData({ loading: true });

    try {
      const packageInfo = await packageApi.getDetail({ id });
      
      if (!packageInfo) {
        throw new Error('Package not found');
      }

      // 使用 normalizeTemplate 处理模板数据，兼容新旧格式
      const normalizedTemplate = normalizeTemplate(packageInfo.template);

      // 标准化套餐价格（可能是"分"或"元"）
      packageInfo.price = normalizePrice(packageInfo.price);

      // Initialize items with products - 新的多商品结构
      // 使用 normalizePrice 统一处理价格单位
      const items = normalizedTemplate.map(item => {
        // 先标准化所有商品价格
        const productsNormalized = item.products.map(product => ({
          ...product,
          price: normalizePrice(product.price) || 0
        }));

        // 计算该分类下所有商品的小计（单位：元）
        const categorySubtotal = productsNormalized.reduce((sum, product) => {
          return sum + (product.price * product.quantity);
        }, 0);

        // 为每个商品添加显示用的格式化价格
        const productsWithDisplay = productsNormalized.map(product => ({
          ...product,
          displayPrice: product.price.toFixed(2),
          subtotal: product.price * product.quantity,
          displaySubtotal: (product.price * product.quantity).toFixed(2)
        }));

        return {
          ...item,
          products: productsWithDisplay,
          categorySubtotal,
          displayCategorySubtotal: categorySubtotal.toFixed(2)
        };
      });

      // Calculate prices
      const priceInfo = this.calculatePrices(items, packageInfo.price);

      this.setData({
        packageInfo,
        items,
        ...priceInfo,
        loading: false
      });

      // Update navigation title
      wx.setNavigationBarTitle({
        title: packageInfo.name
      });

    } catch (err) {
      console.error('Failed to load package detail:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * Calculate total prices - 支持多商品结构
   * 注意：所有价格单位都是"元"（通过 normalizePrice 统一转换）
   */
  calculatePrices(items, packageOriginalPrice = this.data.packageInfo?.price) {
    // Calculate total from all products in all categories（单位：元）
    const itemsTotal = items.reduce((sum, item) => {
      const categoryTotal = item.products.reduce((catSum, product) => {
        return catSum + (product.price * product.quantity);
      }, 0);
      return sum + categoryTotal;
    }, 0);

    const totalPrice = itemsTotal;
    const originalPrice = normalizePrice(packageOriginalPrice) || 0;
    const savedAmount = 0;

    return {
      totalPrice,
      originalPrice,
      savedAmount,
      displayTotalPrice: totalPrice.toFixed(2),  // 已经是"元"
      displayOriginalPrice: originalPrice.toFixed(2)  // 已经是"元"
    };
  },

  /**
   * Update product quantity - 支持多商品结构
   * @param {Object} e - 事件对象，包含 categoryIndex, productIndex, action
   */
  onQuantityChange(e) {
    const { categoryIndex, productIndex, action } = e.currentTarget.dataset;
    const items = [...this.data.items];
    const category = items[categoryIndex];
    const product = category.products[productIndex];

    if (action === 'increase') {
      product.quantity += 1;
    } else if (action === 'decrease' && product.quantity > 1) {
      product.quantity -= 1;
    } else {
      return;
    }

    this.syncItemsAndPrices(items);
  },

  /**
   * Absorb quantity tap to avoid bubbling to replacer
   */
  onQuantityTap() {
    // Do nothing - prevent event propagation to product row
  },

  /**
   * Open product replacer popup - 支持多商品结构
   * @param {Object} e - 事件对象，包含 categoryIndex, productIndex, categoryId, categoryName
   */
  onSelectProduct(e) {
    const { categoryIndex, productIndex, categoryId, categoryName } = e.currentTarget.dataset;
    this.openProductReplacer({
      categoryIndex,
      productIndex,
      categoryId,
      categoryName
    });
  },

  /**
   * 分类删空后的补位入口
   */
  onSelectProductForEmpty(e) {
    const { categoryIndex, categoryId, categoryName } = e.currentTarget.dataset;
    this.openProductReplacer({
      categoryIndex,
      productIndex: -1,
      categoryId,
      categoryName
    });
  },

  /**
   * 生成商品行唯一 key
   */
  buildSwipeRowKey(categoryIndex, productIndex) {
    return `${categoryIndex}-${productIndex}`;
  },

  /**
   * 关闭当前已展开的左滑行
   */
  closeOpenedSwipeRow(excludeRowKey = '') {
    const { swipeOpenRowKey, items } = this.data;
    if (!swipeOpenRowKey || swipeOpenRowKey === excludeRowKey) {
      return;
    }

    const [openCategoryIndex, openProductIndex] = swipeOpenRowKey.split('-').map(Number);
    const openProduct = items[openCategoryIndex]?.products?.[openProductIndex];

    if (!openProduct) {
      this.setData({ swipeOpenRowKey: '' });
      return;
    }

    this.setData({
      [`items[${openCategoryIndex}].products[${openProductIndex}].swipeTranslateX`]: 0,
      [`items[${openCategoryIndex}].products[${openProductIndex}].swipeIsTouchMove`]: false,
      swipeOpenRowKey: ''
    });
  },

  /**
   * 重置指定行左滑状态
   */
  resetSwipeRow(categoryIndex, productIndex) {
    const safeCategoryIndex = Number(categoryIndex);
    const safeProductIndex = Number(productIndex);
    const rowKey = this.buildSwipeRowKey(safeCategoryIndex, safeProductIndex);
    const updates = {
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeTranslateX`]: 0,
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeIsTouchMove`]: false
    };

    if (this.data.swipeOpenRowKey === rowKey) {
      updates.swipeOpenRowKey = '';
    }
    if (this.data.swipeActiveRowKey === rowKey) {
      updates.swipeActiveRowKey = '';
    }

    this.setData(updates);
  },

  /**
   * 左滑手势开始
   */
  onProductTouchStart(e) {
    const { categoryIndex, productIndex } = e.currentTarget.dataset;
    const safeCategoryIndex = Number(categoryIndex);
    const safeProductIndex = Number(productIndex);
    const product = this.data.items[safeCategoryIndex]?.products?.[safeProductIndex];

    if (!product || !e.touches || !e.touches.length) {
      return;
    }

    const rowKey = this.buildSwipeRowKey(safeCategoryIndex, safeProductIndex);
    this.closeOpenedSwipeRow(rowKey);

    this.setData({
      swipeStartX: e.touches[0].clientX,
      swipeStartY: e.touches[0].clientY,
      swipeStartTranslateX: Number(product.swipeTranslateX) || 0,
      swipeActiveRowKey: rowKey
    });
  },

  /**
   * 左滑手势中
   */
  onProductTouchMove(e) {
    const { categoryIndex, productIndex } = e.currentTarget.dataset;
    const safeCategoryIndex = Number(categoryIndex);
    const safeProductIndex = Number(productIndex);
    const rowKey = this.buildSwipeRowKey(safeCategoryIndex, safeProductIndex);

    if (this.data.swipeActiveRowKey !== rowKey || !e.touches || !e.touches.length) {
      return;
    }

    const deltaX = e.touches[0].clientX - this.data.swipeStartX;
    const deltaY = e.touches[0].clientY - this.data.swipeStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 6) {
      return;
    }

    const startTranslateX = Number(this.data.swipeStartTranslateX) || 0;
    const translateX = Math.max(-SWIPE_DELETE_WIDTH, Math.min(0, startTranslateX + deltaX));

    this.setData({
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeTranslateX`]: translateX,
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeIsTouchMove`]: true
    });
  },

  /**
   * 左滑手势结束
   */
  onProductTouchEnd(e) {
    const { categoryIndex, productIndex } = e.currentTarget.dataset;
    const safeCategoryIndex = Number(categoryIndex);
    const safeProductIndex = Number(productIndex);
    const rowKey = this.buildSwipeRowKey(safeCategoryIndex, safeProductIndex);

    if (this.data.swipeActiveRowKey && this.data.swipeActiveRowKey !== rowKey) {
      return;
    }

    const product = this.data.items[safeCategoryIndex]?.products?.[safeProductIndex];
    if (!product) {
      return;
    }

    const translateX = Number(product.swipeTranslateX) || 0;
    const shouldOpen = translateX <= -SWIPE_OPEN_THRESHOLD;
    const updates = {
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeTranslateX`]: shouldOpen ? -SWIPE_DELETE_WIDTH : 0,
      [`items[${safeCategoryIndex}].products[${safeProductIndex}].swipeIsTouchMove`]: false,
      swipeActiveRowKey: ''
    };

    if (shouldOpen) {
      updates.swipeOpenRowKey = rowKey;
    } else if (this.data.swipeOpenRowKey === rowKey) {
      updates.swipeOpenRowKey = '';
    }

    this.setData(updates);
  },

  /**
   * 删除分类中的商品
   */
  onDeleteProduct(e) {
    const { categoryIndex, productIndex } = e.currentTarget.dataset;
    const safeCategoryIndex = Number(categoryIndex);
    const safeProductIndex = Number(productIndex);

    wx.showModal({
      title: '确认删除',
      content: '确认删除该商品吗？',
      confirmColor: '#cf674d',
      success: (res) => {
        if (!res.confirm) {
          this.resetSwipeRow(safeCategoryIndex, safeProductIndex);
          return;
        }

        const updatedItems = [...this.data.items];
        const category = updatedItems[safeCategoryIndex];

        if (!category || !Array.isArray(category.products)) {
          return;
        }

        category.products = [...category.products];
        category.products.splice(safeProductIndex, 1);

        this.setData({
          swipeOpenRowKey: '',
          swipeActiveRowKey: '',
          swipeStartTranslateX: 0
        });
        this.syncItemsAndPrices(updatedItems);

        wx.showToast({
          title: '已删除商品',
          icon: 'none'
        });
      }
    });
  },

  /**
   * Close product replacer popup
   */
  onCloseReplacer() {
    this.setData({
      showReplacer: false,
      currentItem: null,
      currentItemIndex: -1,
      currentProductIndex: -1,
      currentCategoryName: '',
      availableProducts: [],
      selectedProductId: ''
    });
  },

  /**
   * Prevent popup tap from closing
   */
  onPopupTap() {
    // Do nothing - prevent event propagation
  },

  /**
   * Fetch products by category - 支持多商品结构
   * @param {string} categoryId - 分类ID
   * @param {Object} currentProduct - 当前选中的商品
   */
  async fetchProductsByCategory(categoryId, currentProduct) {
    try {
      // 调用 API 获取该分类下的商品
      let products = [];

      try {
        const result = await productApi.getByCategory(categoryId, { page: 1, size: 50 }, { showLoading: false });
        // API 返回的数据结构是 { records, total }
        if (result && result.records && result.records.length > 0) {
          products = result.records;
        }
      } catch (apiErr) {
        console.error('获取商品列表失败:', apiErr);
      }

      // Calculate price difference for each product
      // 注意：后端返回的 product.price 是"元"，currentProduct.price 也是"元"（已在loadPackageDetail中转换）
      const currentPriceYuan = currentProduct ? currentProduct.price : 0;
      const { currentItemIndex, currentProductIndex } = this.data;
      const processedProducts = products.map(product => {
        // product.price 是"元"（云函数已转换）
        const productPriceYuan = product.price || 0;
        const priceDiff = productPriceYuan - currentPriceYuan;
        let priceDiffText = '';

        if (priceDiff > 0) {
          priceDiffText = '+' + priceDiff.toFixed(2);
        } else if (priceDiff < 0) {
          priceDiffText = priceDiff.toFixed(2);
        } else {
          priceDiffText = '0';
        }

        const isDuplicate = this.isDuplicateProductId(product._id, {
          categoryIndex: currentItemIndex,
          productIndex: currentProductIndex
        });

        return {
          ...product,
          displayPrice: productPriceYuan.toFixed(2),
          priceDiff: priceDiff,  // 保持"元"单位
          priceDiffText,
          isDisabled: isDuplicate,
          disabledReason: isDuplicate ? '该商品已在套餐中，不能重复选择' : ''
        };
      });

      this.setData({
        availableProducts: processedProducts,
        loadingProducts: false
      });

    } catch (err) {
      console.error('Failed to fetch products:', err);
      this.setData({
        availableProducts: [],
        loadingProducts: false
      });
      wx.showToast({
        title: '加载商品失败',
        icon: 'none'
      });
    }
  },

  /**
   * Select a replacement product
   */
  onSelectReplacement(e) {
    const { product } = e.currentTarget.dataset;

    if (product.isDisabled) {
      wx.showToast({
        title: product.disabledReason || '该商品已在套餐中，不能重复选择',
        icon: 'none'
      });
      return;
    }

    this.setData({
      selectedProductId: product._id
    });
  },

  /**
   * Confirm product replacement - 支持多商品结构
   */
  onConfirmReplace() {
    const { selectedProductId, currentItemIndex, currentProductIndex, availableProducts, items, currentItem } = this.data;
    const currentProduct = currentItem && currentProductIndex >= 0
      ? currentItem.products[currentProductIndex]
      : null;

    // Check if selection changed
    if (!selectedProductId || (currentProduct && selectedProductId === currentProduct.productId)) {
      this.onCloseReplacer();
      return;
    }

    // Find the selected product
    const newProduct = availableProducts.find(p => p._id === selectedProductId);
    if (!newProduct) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      });
      return;
    }

    if (newProduct.isDisabled || this.isDuplicateProductId(newProduct._id, {
      categoryIndex: currentItemIndex,
      productIndex: currentProductIndex
    })) {
      wx.showToast({
        title: '该商品已在套餐中，不能重复选择',
        icon: 'none'
      });
      return;
    }

    // Update the item with new product
    const updatedItems = [...items];
    const category = updatedItems[currentItemIndex];
    const unitPrice = normalizePrice(newProduct.price) || 0;

    if (currentProductIndex >= 0) {
      const oldProduct = category.products[currentProductIndex];
      const replacementProduct = {
        ...oldProduct,
        productId: newProduct._id,
        productName: newProduct.name,
        price: unitPrice,
        imageUrl: newProduct.imageUrl,
        displayPrice: unitPrice.toFixed(2),
        subtotal: unitPrice * oldProduct.quantity,
        displaySubtotal: (unitPrice * oldProduct.quantity).toFixed(2),
        isCustomized: true,
        swipeTranslateX: 0,
        swipeIsTouchMove: false
      };
      category.products.splice(currentProductIndex, 1, replacementProduct);
    } else {
      category.products = [...(category.products || [])];
      category.products.push({
        productId: newProduct._id,
        productName: newProduct.name,
        price: unitPrice,
        imageUrl: newProduct.imageUrl,
        quantity: 1,
        displayPrice: unitPrice.toFixed(2),
        subtotal: unitPrice,
        displaySubtotal: unitPrice.toFixed(2),
        isCustomized: true,
        swipeTranslateX: 0,
        swipeIsTouchMove: false
      });
    }

    this.setData({
      swipeOpenRowKey: '',
      swipeActiveRowKey: '',
      swipeStartTranslateX: 0
    });
    this.syncItemsAndPrices(updatedItems);

    // Close popup and show feedback
    this.onCloseReplacer();

    wx.showToast({
      title: currentProductIndex >= 0 ? '已替换商品' : '已添加商品',
      icon: 'success'
    });
  },

  /**
   * Navigate to confirm page - 支持多商品结构
   */
  async onConfirm() {
    if (this.data.submitting) return;

    // 登录校验
    const ok = await requireLogin({
      reason: '提交意向单前需要登录，用于保存地址并便于商家联系你',
      onCancel: 'stay'
    });
    if (!ok) return;

    const { packageInfo, items, totalPrice, originalPrice } = this.data;

    // Prepare order data with customization info - 新的多商品结构
    const orderData = {
      packageId: this.data.packageId,
      packageInfo: {
        _id: packageInfo._id,
        name: packageInfo.name,
        description: packageInfo.description,
        type: packageInfo.type,
        imageUrl: packageInfo.imageUrl,
        price: packageInfo.price
      },
      // 新结构：每个分类包含多个商品
      items: items.map(category => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categorySubtotal: category.categorySubtotal,
        products: category.products.map(product => ({
          productId: product.productId,
          productName: product.productName,
          productImage: product.imageUrl,
          unitPrice: product.price,
          quantity: product.quantity,
          subtotal: product.subtotal,
          isCustomized: product.isCustomized || false
        }))
      })),
      totalPrice: totalPrice,
      originalPrice: originalPrice,
      savedAmount: 0
    };

    // Store in global data
    const app = getApp();
    app.globalData.pendingPackageOrder = orderData;

    wx.navigateTo({
      url: '/pages/package/confirm/confirm',
      fail: (err) => {
        console.error('Navigation failed:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * Share configuration
   */
  onShareAppMessage() {
    return {
      title: `${this.data.packageInfo?.name || '精选套餐'} - 为您精心搭配`,
      path: `/pages/package/detail/detail?id=${this.data.packageId}`
    };
  },

  /**
   * 检测设备性能，低端设备禁用毛玻璃效果
   * 判断依据：Android + 低内存/低性能设备
   */
  checkDevicePerformance() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const { platform, system, benchmarkLevel } = systemInfo;
      
      // benchmarkLevel: -1未知, 0-50低端机
      // Android低端机禁用毛玻璃
      const isAndroid = platform === 'android';
      const isLowEnd = benchmarkLevel !== undefined && benchmarkLevel >= 0 && benchmarkLevel < 30;
      
      if (isAndroid && isLowEnd) {
        this.setData({ enableBlur: false });
        console.log('[Performance] Disabled blur effect for low-end device:', { platform, system, benchmarkLevel });
      }
    } catch (err) {
      console.warn('[Performance] Failed to check device performance:', err);
    }
  }
});
