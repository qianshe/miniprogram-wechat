const { api } = require('../../../utils/api.js');

Page({
  data: {
    orderNo: '',
    orderInfo: null,
    loading: true,
    systemType: 'white', // 默认为白事系统
    themeColor: '#333333' // 默认主题色
  },

  onLoad(options) {
    // 获取系统类型
    const systemType = options.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
    
    this.setData({
      systemType,
      themeColor
    });
    
    if (options.orderNo) {
      this.setData({ orderNo: options.orderNo });
      this.loadOrderDetail();
    }
  },

  async loadOrderDetail() {
    try {
      // 调用统一API获取订单详情
      const orderData = await api.getOrderDetail(this.data.orderNo, this.data.isAdmin || false);

      const statusInfo = this.getStatusInfo(orderData.status);

      // 格式化数据
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const totalAmount = Number(orderData.totalAmount || 0);
      
      // 处理联系信息和地址的向后兼容
      let contactName = orderData.contactName || '';
      let contactPhone = orderData.contactPhone || '';
      let addressStr = '';
      
      // 如果contactName为空，尝试从address对象中提取
      const addressObj = orderData.address;
      if (typeof addressObj === 'object' && addressObj !== null) {
        // 从address对象中提取联系信息
        if (!contactName) {
          contactName = addressObj.userName || addressObj.name || '';
        }
        if (!contactPhone) {
          contactPhone = addressObj.telNumber || addressObj.phone || '';
        }
        // 格式化地址字符串
        if (addressObj.fullAddress) {
          addressStr = addressObj.fullAddress;
        } else if (addressObj.provinceName || addressObj.province) {
          const province = addressObj.provinceName || addressObj.province || '';
          const city = addressObj.cityName || addressObj.city || '';
          const county = addressObj.countyName || addressObj.district || '';
          const detail = addressObj.detailInfo || addressObj.detail || '';
          addressStr = `${province}${city}${county}${detail}`;
        }
      } else if (typeof addressObj === 'string') {
        // 地址已经是字符串格式
        addressStr = addressObj;
      }
      
      const orderInfo = {
        ...orderData,
        contactName: contactName,
        contactPhone: contactPhone,
        address: addressStr,
        statusText: statusInfo.text,
        statusDesc: statusInfo.desc,
        statusClass: statusInfo.class,
        createdTime: this.formatDate(orderData.createTime),
        serviceTime: this.formatDate(orderData.serviceTime),
        payTime: orderData.payTime ? this.formatDate(orderData.payTime) : '',
        totalAmount: totalAmount.toFixed(2), // 云函数已转换为元
        items: items.map((item) => {
          return {
            ...item,
            productPrice: item.price.toFixed(2),
            subtotal: item.subtotal.toFixed(2)
          };
        })
      };

      this.setData({
        orderInfo,
        loading: false
      });
    } catch (err) {
      console.error('[订单详情页] 获取订单详情失败:', {
        orderNo: this.data.orderNo,
        isAdmin: this.data.isAdmin || false,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      // 显示错误状态
      this.setData({
        loading: false,
        error: err.message || '获取订单详情失败'
      });

      wx.showToast({
        title: err.message || '获取订单详情失败',
        icon: 'none'
      });
    }
  },




  getStatusInfo(status) {
    const statusInfo = {
      0: {
        text: '待支付',
        desc: '请尽快完成支付',
        class: 'pending'
      },
      1: {
        text: '已支付',
        desc: '我们将尽快为您安排服务',
        class: 'paid'
      },
      2: {
        text: '处理中',
        desc: '服务进行中，请留意通知',
        class: 'processing'
      },
      3: {
        text: '已完成',
        desc: '服务已完成，感谢使用',
        class: 'completed'
      },
      4: {
        text: '已取消',
        desc: '订单已取消',
        class: 'cancelled'
      }
    };
    return statusInfo[status] || {
      text: '未知状态',
      desc: '',
      class: ''
    };
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 复制订单号
  copyOrderNo() {
    wx.setClipboardData({
      data: this.data.orderInfo.orderNo,
      success: () => {
        wx.showToast({
          title: '订单号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 拨打电话
  callPhone() {
    if (this.data.orderInfo.contactPhone) {
      wx.makePhoneCall({
        phoneNumber: this.data.orderInfo.contactPhone
      });
    }
  },

  // 查看位置
  viewLocation() {
    const { latitude, longitude, address } = this.data.orderInfo;
    if (latitude && longitude) {
      wx.openLocation({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        name: address,
        scale: 18
      });
    }
  },

  // 联系客服
  contactService() {
    wx.showToast({
      title: '正在连接客服...',
      icon: 'loading',
      duration: 1500
    });
    // 这里可以接入客服系统
  },

  // 申请退款
  applyRefund() {
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数取消订单（退款等同于取消）
            await api.cancelOrder(this.data.orderNo);
            wx.showToast({
              title: '退款申请已提交',
              icon: 'success'
            });
            // 重新加载订单详情
            this.loadOrderDetail();
          } catch (err) {
            console.error('申请退款失败:', err);
            wx.showToast({
              title: err.message || '申请退款失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 删除订单
  deleteOrder() {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除此订单吗？删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数删除订单
            await api.deleteOrder(this.data.orderNo);
            
            wx.showToast({
              title: '订单已删除',
              icon: 'success'
            });
            
            // 获取页面栈，刷新订单列表页数据
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.loadOrders) {
              prevPage.setData({
                'pagination.page': 1,
                orders: []
              });
              prevPage.loadOrders();
            }
            
            // 返回订单列表页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            console.error('删除订单失败:', err);
            wx.showToast({
              title: err.message || '删除订单失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 再次购买
  rebuyOrder() {
    // 获取订单中的商品信息
    const items = this.data.orderInfo.items;
    if (items && items.length > 0) {
      // 将商品添加到购物车（使用正确的缓存key: cartListLocal）
      const cart = wx.getStorageSync('cartListLocal') || [];
      items.forEach(item => {
        // 使用正确的字段名 id 来查找已存在的商品
        const existingItem = cart.find(i => i.id === item.productId);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          // 使用购物车期望的数据格式：id, name, price(数字), image, quantity
          cart.push({
            id: item.productId,
            name: item.productName,
            price: Number(item.productPrice) || item.price || 0,
            image: item.productImage,
            quantity: item.quantity
          });
        }
      });
      wx.setStorageSync('cartListLocal', cart);
      
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success'
      });
      
      // 跳转到购物车页面（修正路径）
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/cart/cart'
        });
      }, 1500);
    }
  },

  // 返回列表
  goBack() {
    wx.navigateBack();
  },

  async handleCancel() {
    try {
      // 调用云函数取消订单
      await api.cancelOrder(this.data.orderNo);
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      });
      // 重新加载订单详情
      this.loadOrderDetail();
    } catch (err) {
      console.error('取消订单失败:', err);
      wx.showToast({
        title: err.message || '取消订单失败',
        icon: 'none'
      });
    }
  },

  async handlePay() {
    try {
      // 调用云函数支付订单
      await api.payOrder(this.data.orderNo);
      wx.showToast({
        title: '支付成功',
        icon: 'success'
      });
      // 重新加载订单详情
      this.loadOrderDetail();
    } catch (err) {
      console.error('支付订单失败:', err);
      wx.showToast({
        title: err.message || '支付失败',
        icon: 'none'
      });
    }
  },

  getFormattedDiscountAmount() {
    return (this.data.orderInfo.discountAmount / 100).toFixed(2);
  },


});
