const { api } = require('../../../utils/api.js');
const validation = require('../../../utils/validation.js');

const ADDRESS_STORAGE_KEY = 'addressList';

Page({
  data: {
    orderItems: [],
    totalAmount: '0.00',
    address: null,
    remarks: '',
    loading: false,
    errors: {},
    systemType: 'white',
    themeColor: '#333333',
    // 地址选择相关
    showAddressModal: false,
    addressList: [],
    defaultAddress: null
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
      this.setData({
        orderItems: data.selectedItems,
        totalAmount: data.totalAmount,
        systemType: data.systemType || systemType
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

  // 加载本地存储的地址列表
  loadAddressList() {
    const addressList = wx.getStorageSync(ADDRESS_STORAGE_KEY) || [];
    
    // 转换地址格式（地址管理页面格式 -> 订单页面格式）
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
    
    // 如果当前没有选中地址，自动选择默认地址或第一个地址
    if (!this.data.address && formattedList.length > 0) {
      const defaultAddr = formattedList.find(addr => addr.isDefault) || formattedList[0];
      this.setData({ address: defaultAddr });
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
  onSelectAddress(e) {
    const { index } = e.currentTarget.dataset;
    const selectedAddress = this.data.addressList[index];
    
    this.setData({
      address: selectedAddress,
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
      remark: this.data.remarks || ''
    }

    try {
      // 调用统一API创建订单
      const data = await api.createOrder(orderData);

      this.setData({ loading: false });

      const { orderNo } = data;

      // 订单创建成功后，清除已下单的商品
      const orderedItemIds = this.data.orderItems.map(item => item.id);
      const cartItems = wx.getStorageSync('cartListLocal') || [];
      const updatedCartItems = cartItems.filter(item => !orderedItemIds.includes(item.id));
      wx.setStorageSync('cartListLocal', updatedCartItems);

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
