const { api } = require('../../../utils/api.js');
const validation = require('../../../utils/validation.js');
const { loadSelectableAddresses, pickDefaultAddress } = require('../../../utils/addressSelection.js');

const PENDING_CART_CLEANUP_KEY = 'pendingCartCleanupOrders';

function getAddressId(address) {
  if (!address) {
    return '';
  }
  return address.id || address._id || '';
}

function formatAmount(value) {
  return (Number(value) || 0).toFixed(2);
}

function buildOrderItemViewKey(item, index) {
  const baseKey = item && (item.id || item.name || item.image || 'order-item');
  return `${baseKey}-${index}`;
}

function normalizeOrderItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item = {}, index) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;

    return {
      ...item,
      viewKey: buildOrderItemViewKey(item, index),
      displayPrice: formatAmount(price),
      displaySubtotal: formatAmount(price * quantity)
    };
  });
}

function calculateOrderTotal(items = []) {
  const total = (Array.isArray(items) ? items : []).reduce((sum, item = {}) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + (price * quantity);
  }, 0);

  return formatAmount(total);
}

function buildOrderConfirmItemRows(items = []) {
  return (Array.isArray(items) ? items : []).map((item = {}, index) => ({
    key: item.viewKey || item.id || `order-item-${index}`,
    image: item.image || '/images/product-default.png',
    categoryText: '商品',
    nameText: item.name || '',
    unitPriceText: `单价: ${item.displayPrice || '0.00'}`,
    quantityText: `x${item.quantity || 0}`,
    amountText: `¥${item.displaySubtotal || item.displayPrice || '0.00'}`
  }));
}

function buildOrderPriceSummaryRows(totalAmount) {
  return [
    {
      key: 'order-items-total',
      label: '商品合计',
      value: totalAmount,
      showCurrency: false,
      isTotal: false
    },
    {
      key: 'order-total',
      label: '合计',
      value: totalAmount,
      showCurrency: true,
      isTotal: true
    }
  ];
}

function getPendingCartCleanupOrders() {
  const orders = wx.getStorageSync(PENDING_CART_CLEANUP_KEY);
  return Array.isArray(orders) ? orders : [];
}

function savePendingCartCleanupOrders(orders = []) {
  wx.setStorageSync(PENDING_CART_CLEANUP_KEY, orders);
}

function appendPendingCartCleanupOrder(orderNo, orderItems = []) {
  if (!orderNo) {
    return;
  }

  const itemIds = [...new Set((orderItems || []).map(item => item && item.id).filter(Boolean))];
  if (itemIds.length === 0) {
    return;
  }

  const existingOrders = getPendingCartCleanupOrders().filter(item => item && item.orderNo !== orderNo);
  existingOrders.push({ orderNo, itemIds });
  savePendingCartCleanupOrders(existingOrders);
}


Page({
  data: {
    orderItems: [],
    totalAmount: '0.00',
    address: null,
    selectedAddressId: '',
    remarks: '',
    serviceTime: '',
    loading: false,
    errors: {},
    systemType: 'white',
    themeColor: '#333333',
    // 地址选择相关
    showAddressModal: false,
    addressList: [],
    defaultAddress: null,
    confirmItemRows: [],
    priceSummaryRows: []
  },

  onLoad(options) {
    const systemType = options.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';

    this.setData({
      systemType,
      themeColor
    });

    const eventChannel = this.getOpenerEventChannel()
    eventChannel.on('acceptDataFromCart', (data) => {
      const orderItems = normalizeOrderItems(data && data.selectedItems);
      const totalAmount = calculateOrderTotal(orderItems);

      this.setData({
        orderItems,
        totalAmount,
        confirmItemRows: buildOrderConfirmItemRows(orderItems),
        priceSummaryRows: buildOrderPriceSummaryRows(totalAmount),
        systemType: (data && data.systemType) || systemType
      })
    })
    
    // 加载地址列表并设置默认地址
    this.loadAddressList();
  },

  onShow() {
    // 非 tabBar 页面，隐藏 custom-tab-bar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ show: false });
    }
    
    // 每次显示页面时重新加载地址列表（用户可能在地址管理页面新增了地址）
    this.loadAddressList();
  },

  // 加载地址列表（云端优先 + 本地兜底）
  async loadAddressList() {
    try {
      const formattedList = await loadSelectableAddresses();
      this.setData({ addressList: formattedList });
      
      // 如果当前没有选中地址，自动选择默认地址
      if (!this.data.address && formattedList.length > 0) {
        const defaultAddr = pickDefaultAddress(formattedList);
        this.setData({
          address: defaultAddr,
          selectedAddressId: getAddressId(defaultAddr)
        });
      }
    } catch (err) {
      console.error('[confirm] 加载地址失败:', err);
      this.setData({ addressList: [] });
    }
  },

  // 点击地址区域，显示地址选择弹窗
  selectAddress() {
    this.setData({ showAddressModal: true });
  },

  // 关闭地址选择弹窗
  hideAddressModal() {
    this.setData({ showAddressModal: false });
  },

  // 选择地址项
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

  // 使用微信地址
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
        })
      },
      fail: (err) => {
        console.error('选择微信地址失败：', err)
      }
    })
  },

  // 跳转到地址管理页面
  goToAddressManage() {
    this.setData({ showAddressModal: false });
    wx.navigateTo({
      url: '/pages/address/address'
    });
  },

  // 阻止弹窗点击事件冒泡
  preventBubble() {
    // 空方法，用于阻止事件冒泡
  },

  onRemarksChange(e) {
    this.setData({
      remarks: e.detail.value
    })
  },

  onServiceTimeChange(e) {
    this.setData({
      serviceTime: e.detail.value || ''
    })
  },

  async submitOrder() {
    // 清除之前的错误
    this.setData({ errors: {} })

    // 表单验证规则
    const validationRules = {
      address: {
        required: true,
        label: '收货地址',
        type: 'address'
      },
      remarks: {
        required: false,
        label: '备注',
        type: 'string',
        maxLength: 200
      }
    };

    // 构建表单数据
    const formData = {
      address: this.data.address,
      remarks: this.data.remarks || ''
    };

    // 验证地址对象
    const addressValidation = validation.validateAddressObject(this.data.address);
    if (!addressValidation.valid) {
      wx.showToast({
        title: addressValidation.message,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 验证订单商品
    if (!this.data.orderItems || this.data.orderItems.length === 0) {
      wx.showToast({
        title: '订单商品不能为空',
        icon: 'none',
        duration: 3000
      });
      return;
    }

    this.setData({ loading: true })

    // 构建订单数据
    const orderData = {
      items: this.data.orderItems.map(item => ({
        productId: item.id,
        productName: item.name,
        price: item.price,
        quantity: item.quantity,
        productImage: item.image || ''
      })),
      totalAmount: this.data.totalAmount,
      address: this.data.address,
      remark: this.data.remarks || '',
      serviceTime: this.data.serviceTime || null
    }

    try {
      // 调用统一API创建订单
      const data = await api.createOrder(orderData);

      this.setData({ loading: false });

      const { orderNo } = data;
      appendPendingCartCleanupOrder(orderNo, this.data.orderItems);

      wx.showToast({
        title: '订单提交成功',
        icon: 'success',
        success: () => {
          // 延迟返回，确保用户看到提示
          setTimeout(() => {
            // 跳转到订单详情页面
            wx.redirectTo({
              url: `../detail/detail?orderNo=${orderNo}`,
              success: () => {
                // 返回上一页并刷新清单
                const pages = getCurrentPages()
                const cartPage = pages[pages.length - 2]
                if (cartPage && cartPage.loadCartItems) {
                  cartPage.loadCartItems()
                }
              }
            })
          }, 1500)
        }
      });
    } catch (error) {
      console.error('创建订单失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || error.result?.message || '订单创建失败',
        icon: 'none'
      });
    }
  }
})
