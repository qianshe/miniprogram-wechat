/**
 * 套餐详情/定制页面
 * 展示套餐信息，支持商品替换和数量调整
 * 支持多商品数据结构
 */

const productApi = require('../../../api/product.js');

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

// Mock data for development - 使用新的多商品数据结构
const MOCK_PACKAGE = {
  _id: 'pkg_white_001',
  name: '基础套餐',
  description: '适合简单仪式，包含基本殡葬用品。我们精心挑选了高品质的产品，确保仪式庄重得体。',
  type: 'white',
  price: 299900,
  discountPrice: 259900,
  imageUrl: DEFAULT_PACKAGE_IMAGE,
  status: 1,
  sort: 1,
  template: [
    {
      categoryId: 'cat_001',
      categoryName: '花圈',
      products: [
        {
          productId: 'prod_001',
          productName: '白色菊花花圈',
          price: 29900,
          quantity: 2,
          imageUrl: DEFAULT_PRODUCT_IMAGE
        }
      ]
    },
    {
      categoryId: 'cat_002',
      categoryName: '骨灰盒',
      products: [
        {
          productId: 'prod_010',
          productName: '紫檀木骨灰盒',
          price: 89900,
          quantity: 1,
          imageUrl: DEFAULT_PRODUCT_IMAGE
        }
      ]
    },
    {
      categoryId: 'cat_003',
      categoryName: '寿衣',
      products: [
        {
          productId: 'prod_020',
          productName: '传统寿衣套装',
          price: 59900,
          quantity: 1,
          imageUrl: DEFAULT_PRODUCT_IMAGE
        }
      ]
    }
  ]
};

// Mock products for development (when API is not connected)
const MOCK_PRODUCTS_BY_CATEGORY = {
  'cat_001': [
    { _id: 'prod_001', name: '白色菊花花圈', price: 29900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_002', name: '黄色菊花花圈', price: 25900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_003', name: '混合鲜花花圈', price: 35900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_004', name: '高档玫瑰花圈', price: 49900, imageUrl: DEFAULT_PRODUCT_IMAGE }
  ],
  'cat_002': [
    { _id: 'prod_010', name: '紫檀木骨灰盒', price: 89900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_011', name: '黑檀木骨灰盒', price: 79900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_012', name: '金丝楠木骨灰盒', price: 129900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_013', name: '陶瓷骨灰盒', price: 59900, imageUrl: DEFAULT_PRODUCT_IMAGE }
  ],
  'cat_003': [
    { _id: 'prod_020', name: '传统寿衣套装', price: 59900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_021', name: '现代寿衣套装', price: 49900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_022', name: '高档丝绸寿衣', price: 89900, imageUrl: DEFAULT_PRODUCT_IMAGE },
    { _id: 'prod_023', name: '简约寿衣套装', price: 39900, imageUrl: DEFAULT_PRODUCT_IMAGE }
  ]
};

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
    selectedProductId: ''
  },

  onLoad(options) {
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
   * Load package detail
   */
  async loadPackageDetail(id) {
    this.setData({ loading: true });
    
    try {
      // TODO: Replace with actual API call when cloud function is ready
      // const result = await packageApi.getDetail({ id });
      
      // Using mock data for now
      await this.simulateApiCall();
      
      const packageInfo = { ...MOCK_PACKAGE, _id: id };
      
      // 使用 normalizeTemplate 处理模板数据，兼容新旧格式
      const normalizedTemplate = normalizeTemplate(packageInfo.template);
      
      // Initialize items with products - 新的多商品结构
      const items = normalizedTemplate.map(item => {
        // 计算该分类下所有商品的小计
        const categorySubtotal = item.products.reduce((sum, product) => {
          return sum + (product.price * product.quantity);
        }, 0);
        
        // 为每个商品添加显示用的格式化价格
        const productsWithDisplay = item.products.map(product => ({
          ...product,
          displayPrice: (product.price / 100).toFixed(2),
          subtotal: product.price * product.quantity,
          displaySubtotal: ((product.price * product.quantity) / 100).toFixed(2)
        }));
        
        return {
          ...item,
          products: productsWithDisplay,
          categorySubtotal,
          displayCategorySubtotal: (categorySubtotal / 100).toFixed(2)
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
   * Simulate API call delay
   */
  simulateApiCall() {
    return new Promise(resolve => {
      setTimeout(resolve, 300);
    });
  },

  /**
   * Calculate total prices - 支持多商品结构
   */
  calculatePrices(items, packageInfo) {
    // Calculate total from all products in all categories
    const itemsTotal = items.reduce((sum, item) => {
      const categoryTotal = item.products.reduce((catSum, product) => {
        return catSum + (product.price * product.quantity);
      }, 0);
      return sum + categoryTotal;
    }, 0);
    
    // Use package discount price as base, adjust based on item changes
    const originalPrice = packageInfo.price;
    const baseDiscountPrice = packageInfo.discountPrice;
    
    // Calculate the difference from default items - 使用标准化后的模板
    const normalizedDefault = normalizeTemplate(packageInfo.template);
    const defaultTotal = normalizedDefault.reduce((sum, item) => {
      const categoryTotal = item.products.reduce((catSum, product) => {
        return catSum + (product.price * product.quantity);
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
      displayTotalPrice: (totalPrice / 100).toFixed(2),
      displayOriginalPrice: (originalPrice / 100).toFixed(2),
      displaySavedAmount: (savedAmount / 100).toFixed(2),
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
    
    // Recalculate product subtotal
    product.subtotal = product.price * product.quantity;
    product.displaySubtotal = (product.subtotal / 100).toFixed(2);
    
    // Recalculate category subtotal
    category.categorySubtotal = category.products.reduce((sum, p) => {
      return sum + (p.price * p.quantity);
    }, 0);
    category.displayCategorySubtotal = (category.categorySubtotal / 100).toFixed(2);
    
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
      // Try to use API first
      let products = [];
      
      try {
        const result = await productApi.getByCategory(categoryId, { page: 1, size: 50 }, { showLoading: false });
        if (result && result.list && result.list.length > 0) {
          products = result.list;
        }
      } catch (apiErr) {
        console.log('API not available, using mock data');
      }
      
      // Fallback to mock data if API fails or returns empty
      if (products.length === 0) {
        products = MOCK_PRODUCTS_BY_CATEGORY[categoryId] || [];
      }
      
      // Calculate price difference for each product
      const currentPrice = currentProduct ? currentProduct.price : 0;
      const processedProducts = products.map(product => {
        const priceDiff = product.price - currentPrice;
        let priceDiffText = '';
        
        if (priceDiff > 0) {
          priceDiffText = '+' + (priceDiff / 100).toFixed(2);
        } else if (priceDiff < 0) {
          priceDiffText = (priceDiff / 100).toFixed(2);
        } else {
          priceDiffText = '0';
        }
        
        return {
          ...product,
          displayPrice: (product.price / 100).toFixed(2),
          priceDiff,
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
    category.products[currentProductIndex] = {
      ...oldProduct,
      productId: newProduct._id,
      productName: newProduct.name,
      price: newProduct.price,
      imageUrl: newProduct.imageUrl,
      displayPrice: (newProduct.price / 100).toFixed(2),
      subtotal: newProduct.price * oldProduct.quantity,
      displaySubtotal: ((newProduct.price * oldProduct.quantity) / 100).toFixed(2),
      isCustomized: true
    };
    
    // Recalculate category subtotal
    category.categorySubtotal = category.products.reduce((sum, p) => {
      return sum + (p.price * p.quantity);
    }, 0);
    category.displayCategorySubtotal = (category.categorySubtotal / 100).toFixed(2);
    
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
  }
});