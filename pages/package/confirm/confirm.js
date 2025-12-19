/**
 * Package Confirm Page
 * Order confirmation before submission
 */

const { api } = require('../../../utils/api.js');

const ADDRESS_STORAGE_KEY = 'addressList';

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
    displaySavedAmount: '0.00',
    hasSaved: false,
    // Customization info
    hasCustomizedItems: false,
    customizedCount: 0,
    // Remarks
    remarks: '',
    // Submit state
    submitting: false,
    // Address selection
    address: null,
    showAddressModal: false,
    addressList: []
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

  // Load address list from localStorage
  loadAddressList() {
    const addressList = wx.getStorageSync(ADDRESS_STORAGE_KEY) || [];
    
    // Convert address format (address management format -> order format)
    const formattedList = addressList.map(addr => ({
      id: addr.id,
      userName: addr.name,
      telNumber: addr.phone,
      provinceName: addr.province,
      cityName: addr.city,
      countyName: addr.district,
      detailInfo: addr.detail,
      fullAddress: `${addr.province}${addr.city}${addr.district}${addr.detail}`,
      isDefault: addr.isDefault
    }));
    
    this.setData({ addressList: formattedList });
    
    // Auto-select default address or first address if no address selected
    if (!this.data.address && formattedList.length > 0) {
      const defaultAddr = formattedList.find(addr => addr.isDefault) || formattedList[0];
      this.setData({ address: defaultAddr });
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
  onSelectAddress(e) {
    const { index } = e.currentTarget.dataset;
    const selectedAddress = this.data.addressList[index];
    
    this.setData({
      address: selectedAddress,
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
    const displayOriginalPrice = orderData.originalPrice.toFixed(2);
    const displayTotalPrice = orderData.totalPrice.toFixed(2);
    const displaySavedAmount = orderData.savedAmount.toFixed(2);
    const hasSaved = orderData.savedAmount > 0;

    this.setData({
      loading: false,
      packageInfo: orderData.packageInfo,
      packageId: orderData.packageId,
      items: flattenedItems,
      originalPrice: orderData.originalPrice,
      totalPrice: orderData.totalPrice,
      savedAmount: orderData.savedAmount,
      displayOriginalPrice,
      displayTotalPrice,
      displaySavedAmount,
      hasSaved,
      hasCustomizedItems,
      customizedCount
    });

    // Update navigation title
    wx.setNavigationBarTitle({
      title: '确认订单'
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
    if (!this.validateOrder()) {
      return;
    }

    if (this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });

    try {
      // Prepare order data matching orderManagement.createOrder protocol
      // Expected: totalAmount (yuan), address object, items with productId/productName/price/quantity/productImage
      const orderData = {
        items: this.data.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
          productImage: item.productImage || ''
        })),
        totalAmount: this.data.totalPrice.toFixed(2),
        address: this.data.address,
        remark: this.data.remarks || '',
        // Package-specific fields for reference
        orderType: 'package',
        packageId: this.data.packageId,
        packageName: this.data.packageInfo.name,
        originalPrice: this.data.originalPrice,
        savedAmount: this.data.savedAmount
      };

      // Call unified API to create order
      const result = await api.createOrder(orderData);

      // Clear pending order data
      const app = getApp();
      if (app.globalData) {
        app.globalData.pendingPackageOrder = null;
      }

      const { orderNo } = result;

      wx.showToast({
        title: '订单提交成功',
        icon: 'success'
      });

      // Navigate to order detail or list page
      setTimeout(() => {
        if (orderNo) {
          wx.redirectTo({
            url: `/pages/order/detail/detail?orderNo=${orderNo}`,
            fail: () => {
              wx.redirectTo({
                url: '/pages/order/list/list'
              });
            }
          });
        } else {
          wx.redirectTo({
            url: '/pages/order/list/list',
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index'
              });
            }
          });
        }
      }, 1500);

    } catch (error) {
      console.error('Submit order failed:', error);
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
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