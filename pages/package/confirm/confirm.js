/**
 * Package Confirm Page
 * Order confirmation before submission
 */

const orderApi = require('../../../api/order.js');

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
    submitting: false
  },

  onLoad(options) {
    // Get package data from previous page or global state
    this.loadOrderData(options);
  },

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

    // Process items for display
    const processedItems = orderData.items.map(item => ({
      ...item,
      displayUnitPrice: (item.unitPrice / 100).toFixed(2),
      displaySubtotal: (item.subtotal / 100).toFixed(2)
    }));

    // Count customized items
    const customizedItems = processedItems.filter(item => item.isCustomized);
    const hasCustomizedItems = customizedItems.length > 0;
    const customizedCount = customizedItems.length;

    // Calculate display prices
    const displayOriginalPrice = (orderData.originalPrice / 100).toFixed(2);
    const displayTotalPrice = (orderData.totalPrice / 100).toFixed(2);
    const displaySavedAmount = (orderData.savedAmount / 100).toFixed(2);
    const hasSaved = orderData.savedAmount > 0;

    this.setData({
      loading: false,
      packageInfo: orderData.packageInfo,
      packageId: orderData.packageId,
      items: processedItems,
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
    const { packageInfo, items, totalPrice } = this.data;

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
      // Prepare order data for API
      const orderData = {
        type: 'package',
        packageId: this.data.packageId,
        packageName: this.data.packageInfo.name,
        items: this.data.items.map(item => ({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
          isCustomized: item.isCustomized || false
        })),
        originalPrice: this.data.originalPrice,
        totalPrice: this.data.totalPrice,
        savedAmount: this.data.savedAmount,
        remarks: this.data.remarks || ''
      };

      // Call order API
      const result = await orderApi.create(orderData);

      // Clear pending order data
      const app = getApp();
      if (app.globalData) {
        app.globalData.pendingPackageOrder = null;
      }

      wx.showToast({
        title: '订单提交成功',
        icon: 'success'
      });

      // Navigate to order list or success page
      setTimeout(() => {
        // Try to navigate to order list, fallback to home if not exists
        wx.redirectTo({
          url: '/pages/order/list/list',
          fail: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
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