/**
 * Package Confirm Page
 * Order confirmation before submission
 */

const { api } = require('../../../utils/api.js');
const { loadSelectableAddresses, pickDefaultAddress } = require('../../../utils/addressSelection.js');
const { requireLogin } = require('../../../utils/authGuard.js');

function getAddressId(address) {
  if (!address) {
    return '';
  }
  return address.id || address._id || '';
}

function buildPackageConfirmItemRows(items = []) {
  return (Array.isArray(items) ? items : []).map((item = {}, index) => ({
    key: item.productId || `${item.productName || 'package-item'}-${index}`,
    image: item.productImage || '/images/product-default.png',
    categoryText: item.categoryName || '',
    nameText: item.productName || '',
    unitPriceText: `单价: ${item.displayUnitPrice || '0.00'}`,
    quantityText: `x${item.quantity || 0}`,
    amountText: item.displaySubtotal || '0.00',
    badgeText: '',
    highlighted: false
  }));
}

function buildPackagePriceSummaryRows(displayOriginalPrice, displayTotalPrice) {
  return [
    {
      key: 'package-original-price',
      label: '套餐原价',
      value: displayOriginalPrice,
      crossed: true,
      showCurrency: false,
      isTotal: false
    },
    {
      key: 'package-total-price',
      label: '参考合计',
      value: displayTotalPrice,
      showCurrency: true,
      isTotal: true
    }
  ];
}


Page({
  data: {
    loading: true,
    packageInfo: null,
    items: [],
    // Price breakdown
    originalPrice: 0,
    totalPrice: 0,
    savedAmount: 0,
    // Display prices
    displayOriginalPrice: '0.00',
    displayTotalPrice: '0.00',
    // Customization info
    hasCustomizedItems: false,
    customizedCount: 0,
    // Remarks
    remarks: '',
    serviceTime: '',
    // Submit state
    submitting: false,
    // Address selection
    address: null,
    selectedAddressId: '',
    showAddressModal: false,
    addressList: [],
    confirmItemRows: [],
    priceSummaryRows: []
  },

  onLoad(options) {
    // Get package data from previous page or global state
    this.loadOrderData(options);
    // Load address list
    this.loadAddressList();
  },

  onShow() {
    // Reload address list when page shows (user may have added new address)
    this.loadAddressList();
  },

  // 加载地址列表（云端优先 + 本地兜底）
  async loadAddressList() {
    try {
      const formattedList = await loadSelectableAddresses();
      this.setData({ addressList: formattedList });
      
      // 自动选择默认地址或第一个地址
      if (!this.data.address && formattedList.length > 0) {
        const defaultAddr = pickDefaultAddress(formattedList);
        this.setData({
          address: defaultAddr,
          selectedAddressId: getAddressId(defaultAddr)
        });
      }
    } catch (err) {
      console.error('[package-confirm] 加载地址失败:', err);
      this.setData({ addressList: [] });
    }
  },

  // Show address selection modal
  selectAddress() {
    this.setData({ showAddressModal: true });
  },

  // Hide address selection modal
  hideAddressModal() {
    this.setData({ showAddressModal: false });
  },

  // Select an address from list
  onConfirmAddressSelect(e) {
    const selectedAddress = e.detail && e.detail.address;
    if (!selectedAddress) {
      return;
    }
    
    this.setData({
      address: selectedAddress,
      selectedAddressId: getAddressId(selectedAddress),
      showAddressModal: false
    });
  },

  // Use WeChat address
  useWechatAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          address: {
            userName: res.userName,
            telNumber: res.telNumber,
            provinceName: res.provinceName,
            cityName: res.cityName,
            countyName: res.countyName,
            detailInfo: res.detailInfo,
            fullAddress: `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`
          },
          selectedAddressId: '',
          showAddressModal: false
        });
      },
      fail: (err) => {
        console.error('选择微信地址失败：', err);
      }
    });
  },

  // Go to address management page
  goToAddressManage() {
    this.setData({ showAddressModal: false });
    wx.navigateTo({
      url: '/pages/address/address'
    });
  },

  // Prevent event bubbling
  preventBubble() {},

  /**
   * Load order data from global state
   */
  loadOrderData(options) {
    const app = getApp();
    const orderData = app.globalData?.pendingPackageOrder;

    if (!orderData) {
      wx.showToast({
        title: '订单数据不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // Flatten items from category structure to product list
    // orderData.items is array of categories with products array
    const flattenedItems = [];
    if (Array.isArray(orderData.items)) {
      orderData.items.forEach(category => {
        if (category.products && Array.isArray(category.products)) {
          category.products.forEach(product => {
            flattenedItems.push({
              categoryId: category.categoryId,
              categoryName: category.categoryName,
              productId: product.productId,
              productName: product.productName,
              productImage: product.productImage,
              unitPrice: product.unitPrice,
              quantity: product.quantity,
              subtotal: product.subtotal,
              isCustomized: product.isCustomized || false,
              displayUnitPrice: product.unitPrice.toFixed(2),
              displaySubtotal: product.subtotal.toFixed(2)
            });
          });
        }
      });
    }

    // Count customized items
    const customizedItems = flattenedItems.filter(item => item.isCustomized);
    const hasCustomizedItems = customizedItems.length > 0;
    const customizedCount = customizedItems.length;

    // Calculate display prices (prices are already in yuan, no need to divide by 100)
    const packageOriginalPrice = Number(orderData.packageInfo?.price || orderData.originalPrice || 0);
    const referenceTotalPrice = Number(orderData.totalPrice || 0);
    const displayOriginalPrice = packageOriginalPrice.toFixed(2);
    const displayTotalPrice = referenceTotalPrice.toFixed(2);
    const confirmItemRows = buildPackageConfirmItemRows(flattenedItems);
    const priceSummaryRows = buildPackagePriceSummaryRows(displayOriginalPrice, displayTotalPrice);

    this.setData({
      loading: false,
      packageInfo: orderData.packageInfo,
      packageId: orderData.packageId,
      items: flattenedItems,
      originalPrice: packageOriginalPrice,
      totalPrice: referenceTotalPrice,
      savedAmount: 0,
      displayOriginalPrice,
      displayTotalPrice,
      hasCustomizedItems,
      customizedCount,
      confirmItemRows,
      priceSummaryRows
    });

    // Update navigation title
    wx.setNavigationBarTitle({
      title: '确认服务信息'
    });
  },

  /**
   * Handle remarks input
   */
  onRemarksInput(e) {
    this.setData({
      remarks: e.detail.value
    });
  },

  onServiceTimeChange(e) {
    this.setData({
      serviceTime: e.detail.value || ''
    });
  },

  /**
   * Validate order data
   */
  validateOrder() {
    const { packageInfo, items, totalPrice, address } = this.data;

    // Validate address
    if (!address) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'none'
      });
      return false;
    }

    if (!address.userName || !address.telNumber) {
      wx.showToast({
        title: '收货地址信息不完整',
        icon: 'none'
      });
      return false;
    }

    if (!packageInfo || !packageInfo._id) {
      wx.showToast({
        title: '套餐信息不完整',
        icon: 'none'
      });
      return false;
    }

    if (!items || items.length === 0) {
      wx.showToast({
        title: '订单商品不能为空',
        icon: 'none'
      });
      return false;
    }

    if (!totalPrice || totalPrice <= 0) {
      wx.showToast({
        title: '订单金额异常',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  /**
   * Submit order
   */
  async onSubmitOrder() {
    wx.showModal({
      title: '当前不可在线提交',
      content: '当前小程序仅支持查看套餐信息与线下服务咨询，如需继续，请联系服务人员。',
      showCancel: false,
      confirmText: '我知道了'
    });
    return;
  },

  /**
   * Go back to modify package
   */
  onGoBack() {
    wx.navigateBack();
  },

  /**
   * Share configuration
   */
  onShareAppMessage() {
    return {
      title: '精选套餐 - 为您精心搭配',
      path: '/pages/package/list/list'
    };
  }
});