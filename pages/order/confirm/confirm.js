const { api } = require('../../../utils/api.js');
const validation = require('../../../utils/validation.js');

Page({
  data: {
    orderItems: [],
    totalAmount: '0.00',
    address: null,
    remarks: '',
    loading: false,
    errors: {},
    systemType: 'white', // 默认为白事系统
    themeColor: '#333333', // 默认主题色
    defaultAddress: {
      userName: '张三',
      telNumber: '13800138000',
      provinceName: '广东省',
      cityName: '深圳市',
      countyName: '南山区',
      detailInfo: '科技园路888号',
      fullAddress: '广东省深圳市南山区科技园路888号'
    }
  },

  onLoad(options) {
    // 获取系统类型
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
    // 设置默认地址
    if (!this.data.address) {
      this.setData({
        address: this.data.defaultAddress
      })
    }
  },

  selectAddress() {
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
          }
        })
      },
      fail: (err) => {
        console.error('选择地址失败：', err)
      }
    })
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
        quantity: item.quantity
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
