const { api } = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const validation = require('../utils/validation.js');
const { loadSelectableAddresses, pickDefaultAddress } = require('../../../utils/addressSelection.js');

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

  isOrderCreateAllowed() {
    return auth.isAdmin();
  },

  handleOrderCreateBlocked() {
    wx.showToast({ title: '清单仅用于需求登记', icon: 'none' });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/index/index' });
        }
      });
    }, 1200);
  },

  onLoad(options) {
    if (!this.isOrderCreateAllowed()) {
      this.handleOrderCreateBlocked();
      return;
    }
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
    if (!this.isOrderCreateAllowed()) {
      this.handleOrderCreateBlocked();
      return;
    }
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
    wx.showModal({
      title: '当前不可在线提交',
      content: '当前小程序仅支持信息查询、服务记录查看与线下服务确认。如需继续，请联系服务人员。',
      showCancel: false,
      confirmText: '我知道了'
    });
    return;
  }
})
