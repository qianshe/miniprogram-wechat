/**
 * 套餐详情/定制页面
 * 展示套餐信息，支持商品替换和数量调整
 * 支持多商品数据结构
 */

const packageApi = require('../../../api/package.js');
const productApi = require('../../../api/product.js');
const { normalizePrice } = require('../../../utils/util.js');

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

    // 性能优化：低端设备禁用毛玻璃效果
    enableBlur: true
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
      packageInfo.discountPrice = normalizePrice(packageInfo.discountPrice);

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
      const priceInfo = this.calculatePrices(items, packageInfo);

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
  calculatePrices(items, packageInfo) {
    // Calculate total from all products in all categories（单位：元）
    const itemsTotal = items.reduce((sum, item) => {
      const categoryTotal = item.products.reduce((catSum, product) => {
        return catSum + (product.price * product.quantity);
      }, 0);
      return sum + categoryTotal;
    }, 0);

    // packageInfo.price 和 discountPrice 已经在 loadPackageDetail 中通过 normalizePrice 转换为"元"
    // 如果没有设置套餐原价，使用商品总价作为原价（使用 ?? 处理 null 值）
    const originalPrice = packageInfo.price ?? itemsTotal;
    // 如果没有设置优惠价，使用商品总价（即无优惠）（使用 ?? 处理 null 值，避免 NaN）
    const baseDiscountPrice = packageInfo.discountPrice ?? itemsTotal;

    // Calculate the difference from default items - 使用标准化后的模板
    // 注意：模板中的价格需要通过 normalizePrice 转换
    const normalizedDefault = normalizeTemplate(packageInfo.template);
    const defaultTotal = normalizedDefault.reduce((sum, item) => {
      const categoryTotal = item.products.reduce((catSum, product) => {
        const priceInYuan = normalizePrice(product.price) || 0;
        return catSum + (priceInYuan * product.quantity);
      }, 0);
      return sum + categoryTotal;
    }, 0);

    const priceDiff = itemsTotal - defaultTotal;
    const totalPrice = baseDiscountPrice + priceDiff;
    const savedAmount = originalPrice - totalPrice;

    return {
      totalPrice,
      originalPrice,
      savedAmount,
      displayTotalPrice: totalPrice.toFixed(2),  // 已经是"元"
      displayOriginalPrice: originalPrice.toFixed(2),  // 已经是"元"
      displaySavedAmount: savedAmount.toFixed(2),  // 已经是"元"
      hasSaved: savedAmount > 0
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

    // Recalculate product subtotal（单位：元）
    product.subtotal = product.price * product.quantity;
    product.displaySubtotal = product.subtotal.toFixed(2);  // 已经是"元"

    // Recalculate category subtotal（单位：元）
    category.categorySubtotal = category.products.reduce((sum, p) => {
      return sum + (p.price * p.quantity);
    }, 0);
    category.displayCategorySubtotal = category.categorySubtotal.toFixed(2);  // 已经是"元"

    // Recalculate total prices
    const priceInfo = this.calculatePrices(items, this.data.packageInfo);

    this.setData({
      items,
      ...priceInfo
    });
  },

  /**
   * Open product replacer popup - 支持多商品结构
   * @param {Object} e - 事件对象，包含 categoryIndex, productIndex, categoryId, categoryName
   */
  onSelectProduct(e) {
    const { categoryIndex, productIndex, categoryId, categoryName } = e.currentTarget.dataset;
    const currentItem = this.data.items[categoryIndex];
    const currentProduct = currentItem.products[productIndex];

    this.setData({
      showReplacer: true,
      currentItem,
      currentItemIndex: categoryIndex,
      currentProductIndex: productIndex,
      currentCategoryName: categoryName,
      selectedProductId: currentProduct.productId,
      availableProducts: [],
      loadingProducts: true
    });

    // Fetch products by category
    this.fetchProductsByCategory(categoryId, currentProduct);
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

        return {
          ...product,
          displayPrice: productPriceYuan.toFixed(2),
          priceDiff: priceDiff,  // 保持"元"单位
          priceDiffText
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
    this.setData({
      selectedProductId: product._id
    });
  },

  /**
   * Confirm product replacement - 支持多商品结构
   */
  onConfirmReplace() {
    const { selectedProductId, currentItemIndex, currentProductIndex, availableProducts, items, currentItem } = this.data;
    const currentProduct = currentItem.products[currentProductIndex];

    // Check if selection changed
    if (!selectedProductId || selectedProductId === currentProduct.productId) {
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

    // Update the item with new product
    const updatedItems = [...items];
    const category = updatedItems[currentItemIndex];
    const oldProduct = category.products[currentProductIndex];

    // Update the product in the products array
    // 注意：newProduct.price 已经是"元"（云函数已转换）
    category.products[currentProductIndex] = {
      ...oldProduct,
      productId: newProduct._id,
      productName: newProduct.name,
      price: newProduct.price,  // 已经是"元"
      imageUrl: newProduct.imageUrl,
      displayPrice: newProduct.price.toFixed(2),  // 已经是"元"
      subtotal: newProduct.price * oldProduct.quantity,
      displaySubtotal: (newProduct.price * oldProduct.quantity).toFixed(2),  // 已经是"元"
      isCustomized: true
    };

    // Recalculate category subtotal（单位：元）
    category.categorySubtotal = category.products.reduce((sum, p) => {
      return sum + (p.price * p.quantity);
    }, 0);
    category.displayCategorySubtotal = category.categorySubtotal.toFixed(2);  // 已经是"元"

    // Recalculate prices
    const priceInfo = this.calculatePrices(updatedItems, this.data.packageInfo);

    this.setData({
      items: updatedItems,
      ...priceInfo
    });

    // Close popup and show feedback
    this.onCloseReplacer();

    wx.showToast({
      title: '已替换商品',
      icon: 'success'
    });
  },

  /**
   * Navigate to confirm page - 支持多商品结构
   */
  onConfirm() {
    if (this.data.submitting) return;

    const { packageInfo, items, totalPrice, originalPrice, savedAmount } = this.data;

    // Prepare order data with customization info - 新的多商品结构
    const orderData = {
      packageId: this.data.packageId,
      packageInfo: {
        _id: packageInfo._id,
        name: packageInfo.name,
        description: packageInfo.description,
        type: packageInfo.type,
        imageUrl: packageInfo.imageUrl
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
      savedAmount: savedAmount > 0 ? savedAmount : 0
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