const { api, adminApi } = require('../../../utils/api.js');
const cartApi = require('../../../api/cart.js');
const auth = require('../../../utils/auth.js');
const {
  getOrderStatusInfo,
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  getOrderFlowText,
  getPaymentStatusText,
  mapLegacyStatusToNew
} = require('../../../config/constants.js');
const { formatDate } = require('../../../utils/util.js');

Page({
  data: {
    orderNo: '',
    orderInfo: null,
    loading: true,
    systemType: 'white', // 默认为白事系统
    themeColor: '#333333', // 默认主题色
    isAdmin: false, // 是否为管理员
    // 管理员按钮显示控制（双字段系统）
    showStartProcessingBtn: false,
    showMarkServiceDoneBtn: false,
    showConfirmPaymentBtn: false,
    showCancelBtn: false,
    showNoActionTip: false,
    // 用户端按钮显示控制（双字段系统）
    showPayBtn: false,
    showUserCancelBtn: false,
    showUserNoActionTip: false
  },

  onLoad(options) {
    // 获取系统类型
    const systemType = options.systemType || 'white';
    const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
    
    // 获取管理员状态
    const isAdmin = options.isAdmin === 'true' || options.isAdmin === true;
    
    this.setData({
      systemType,
      themeColor,
      isAdmin
    });
    
    if (options.orderNo) {
      this.setData({ orderNo: options.orderNo });
      this.loadOrderDetail();
    }
  },

  onShow() {
    if (this.data.orderNo) {
      this.loadOrderDetail();
    }
  },

  async loadOrderDetail() {
    try {
      // 调用统一API获取订单详情
      const orderData = await api.getOrderDetail(this.data.orderNo, this.data.isAdmin || false);

      const statusInfo = getOrderStatusInfo(orderData.status);

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
      
      // 判断是否已付款（兼容旧字段）
      const isPaid = !!orderData.payTime || (orderData.paymentMethod && orderData.paymentMethod !== 'not_paid');
      
      // === 双字段状态系统处理 ===
      let orderStatus = orderData.orderStatus;
      let paymentStatus = orderData.paymentStatus;
      
      // 兼容旧数据：如果没有新字段，从旧 status 映射
      if (orderStatus === undefined || orderStatus === null) {
        const mapped = mapLegacyStatusToNew(orderData.status, orderData.payTime);
        orderStatus = mapped.orderStatus;
        paymentStatus = mapped.paymentStatus;
      }
      
      // 获取双字段状态文本
      const orderStatusText = getOrderFlowText(orderStatus);
      const paymentStatusText = getPaymentStatusText(paymentStatus);
      
      // 处理status=5的状态描述（兼容旧系统）
      let customStatusDesc = statusInfo.desc;
      if (orderData.status === 5 && orderData.payDeadlineAt) {
        const deadline = new Date(orderData.payDeadlineAt);
        customStatusDesc = `服务已完成，请于 ${deadline.getMonth()+1}月${deadline.getDate()}日 前完成付款`;
      } else if (orderData.status === 2 && !isPaid) {
        customStatusDesc = '服务进行中，可随时付款';
      }
      
      // 根据双字段系统生成状态描述
      let flowStatusDesc = '';
      if (orderStatus === ORDER_FLOW_STATUS.CREATED) {
        flowStatusDesc = paymentStatus === PAYMENT_STATUS.PAID ? '已付款，等待服务' : '等待服务开始';
      } else if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) {
        flowStatusDesc = paymentStatus === PAYMENT_STATUS.PAID ? '服务进行中' : '服务进行中，可随时付款';
      } else if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) {
        flowStatusDesc = paymentStatus === PAYMENT_STATUS.PAID ? '服务已完成，订单即将结束' : '服务已完成，请尽快完成付款';
      } else if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) {
        flowStatusDesc = '订单已完成';
      } else if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) {
        flowStatusDesc = '订单已取消';
      }
      
      const orderInfo = {
        ...orderData,
        contactName: contactName,
        contactPhone: contactPhone,
        address: addressStr,
        isPaid: isPaid,
        // 旧状态系统（兼容）
        statusText: statusInfo.text,
        statusDesc: customStatusDesc,
        statusClass: statusInfo.class,
        // 新双字段状态系统
        orderStatus: orderStatus,
        paymentStatus: paymentStatus,
        orderStatusText: orderStatusText,
        paymentStatusText: paymentStatusText,
        flowStatusDesc: flowStatusDesc,
        createdTime: formatDate(orderData.createTime),
        serviceTime: formatDate(orderData.serviceTime),
        payTime: orderData.payTime ? formatDate(orderData.payTime) : '',
        processTime: orderData.processTime ? formatDate(orderData.processTime) : '',
        completeTime: orderData.completeTime ? formatDate(orderData.completeTime) : '',
        // 时间线专用的短格式时间 (MM-DD)
        timelineCreatedTime: this.formatShortDate(orderData.createTime),
        timelinePayTime: orderData.payTime ? this.formatShortDate(orderData.payTime) : '',
        timelineProcessTime: orderData.processTime ? this.formatShortDate(orderData.processTime) : '',
        timelineCompleteTime: orderData.completeTime ? this.formatShortDate(orderData.completeTime) : '',
        totalAmount: totalAmount.toFixed(2), // 云函数已转换为元
        items: items.map((item) => {
          return {
            ...item,
            productPrice: item.price.toFixed(2),
            subtotal: item.subtotal.toFixed(2)
          };
        })
      };

      // 计算按钮显示状态（基于双字段系统）
      let btnStates = {};
      if (this.data.isAdmin) {
        // 管理员按钮状态
        btnStates = this.calculateAdminButtonStates(orderStatus, paymentStatus);
      } else {
        // 用户端按钮状态
        btnStates = this.calculateUserButtonStates({ orderStatus, paymentStatus });
      }

      this.setData({
        orderInfo,
        loading: false,
        ...btnStates
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

  // 短格式日期，用于时间线显示 (MM-DD)
  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  /**
   * 计算用户端按钮显示状态（基于新双字段状态系统）
   * 按钮规则：
   * | orderStatus | paymentStatus | 用户端显示的按钮 |
   * |-------------|---------------|-----------------|
   * | CREATED(0) | UNPAID(0) | 去支付、取消订单 |
   * | CREATED(0) | PAID(1) | (等待服务，无操作按钮) |
   * | PROCESSING(1) | UNPAID(0) | 去支付 |
   * | PROCESSING(1) | PAID(1) | (服务中，无操作按钮) |
   * | SERVICE_DONE(2) | UNPAID(0) | 去支付（支付后自动转为 COMPLETED）|
   * | SERVICE_DONE(2) | PAID(1) | (通常已自动完成，无按钮) |
   * | COMPLETED(3) | - | 无操作按钮 |
   * | CANCELLED(4) | - | 无操作按钮 |
   */
  calculateUserButtonStates(order) {
    const orderStatus = order.orderStatus !== undefined ? order.orderStatus : 0;
    const paymentStatus = order.paymentStatus !== undefined ? order.paymentStatus : 0;
    
    return {
      // 显示"去支付"按钮: 未支付 且 订单未完成/未取消
      showPayBtn: paymentStatus === PAYMENT_STATUS.UNPAID && orderStatus < ORDER_FLOW_STATUS.COMPLETED,
      // 显示"取消订单"按钮: 仅在 CREATED 状态且未支付时
      showUserCancelBtn: orderStatus === ORDER_FLOW_STATUS.CREATED && paymentStatus === PAYMENT_STATUS.UNPAID,
      // 显示"无操作"提示: 已完成/已取消 或 已支付但订单未完成
      showUserNoActionTip: orderStatus >= ORDER_FLOW_STATUS.COMPLETED || (paymentStatus === PAYMENT_STATUS.PAID && orderStatus < ORDER_FLOW_STATUS.COMPLETED)
    };
  },

  /**
   * 计算管理员按钮显示状态（基于双字段系统）
   * 按钮规则：
   * | orderStatus | paymentStatus | 显示的按钮 |
   * |-------------|---------------|-----------|
   * | CREATED(0) | UNPAID(0) | 开始处理、确认收款、取消订单 |
   * | CREATED(0) | PAID(1) | 开始处理、取消订单 |
   * | PROCESSING(1) | UNPAID(0) | 标记服务完成、确认收款 |
   * | PROCESSING(1) | PAID(1) | 标记服务完成 |
   * | SERVICE_DONE(2) | UNPAID(0) | 确认收款 |
   * | SERVICE_DONE(2) | PAID(1) | (自动转为 COMPLETED，通常不显示) |
   * | COMPLETED(3) | - | 无操作按钮 |
   * | CANCELLED(4) | - | 无操作按钮 |
   */
  calculateAdminButtonStates(orderStatus, paymentStatus) {
    return {
      // 开始处理：仅 CREATED 状态可用
      showStartProcessingBtn: orderStatus === ORDER_FLOW_STATUS.CREATED,
      // 标记服务完成：仅 PROCESSING 状态可用
      showMarkServiceDoneBtn: orderStatus === ORDER_FLOW_STATUS.PROCESSING,
      // 确认收款：未支付且订单未完成/未取消时可用
      showConfirmPaymentBtn: paymentStatus === PAYMENT_STATUS.UNPAID && orderStatus < ORDER_FLOW_STATUS.COMPLETED,
      // 取消订单：仅 CREATED 或 PROCESSING 状态可用
      showCancelBtn: orderStatus <= ORDER_FLOW_STATUS.PROCESSING,
      // 无操作提示：已完成或已取消
      showNoActionTip: orderStatus >= ORDER_FLOW_STATUS.COMPLETED
    };
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
  async rebuyOrder() {
    // 获取订单中的商品信息
    const items = this.data.orderInfo.items;
    if (!items || items.length === 0) {
      wx.showToast({
        title: '订单商品为空',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '添加中...' });

    try {
      const isLoggedIn = auth.checkAuth();
      
      // 同时更新本地缓存
      const cart = wx.getStorageSync('cartListLocal') || [];
      
      for (const item of items) {
        const productData = {
          productId: item.productId,
          name: item.productName,
          price: Number(item.productPrice) || item.price || 0,
          image: item.productImage,
          quantity: item.quantity
        };

        // 如果已登录，调用云端API添加商品
        if (isLoggedIn) {
          await cartApi.add(productData);
        }

        // 更新本地缓存
        const existingItem = cart.find(i => i.id === item.productId);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          cart.push({
            id: item.productId,
            name: item.productName,
            price: Number(item.productPrice) || item.price || 0,
            image: item.productImage,
            quantity: item.quantity
          });
        }
      }

      // 保存本地缓存
      wx.setStorageSync('cartListLocal', cart);

      wx.hideLoading();
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success'
      });
      
      // 跳转到购物车页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/cart/cart'
        });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('再次购买失败:', err);
      wx.showToast({
        title: err.message || '添加失败',
        icon: 'none'
      });
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

  /**
   * 用户端操作：去支付（双字段系统）
   * 复用现有的 handlePay 方法
   */
  handlePayOrder() {
    this.handlePay();
  },

  /**
   * 用户端操作：取消订单（双字段系统）
   */
  handleUserCancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const result = await wx.cloud.callFunction({
              name: 'orderManagement',
              data: {
                action: 'updateOrderFlowStatus',
                data: {
                  orderId: this.data.orderInfo._id,
                  orderStatus: ORDER_FLOW_STATUS.CANCELLED
                }
              }
            });
            wx.hideLoading();
            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '订单已取消', icon: 'success' });
              this.loadOrderDetail();
            } else {
              wx.showToast({ title: (result.result && result.result.message) || '取消失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('取消订单失败:', err);
            wx.showToast({ title: '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

  getFormattedDiscountAmount() {
    return (this.data.orderInfo.discountAmount / 100).toFixed(2);
  },

  // 管理员操作：上一步（回退状态）
  async handlePrevStep() {
    const currentStatus = this.data.orderInfo.status;
    let prevStatus;
    
    // 根据当前状态确定上一步状态
    // 0:待支付 -> 无上一步
    // 1:已支付 -> 0:待支付
    // 2:处理中 -> 1:已支付
    // 3:已完成 -> 2:处理中
    // 4:已取消 -> 无上一步
    switch (currentStatus) {
      case 1:
        prevStatus = 0;
        break;
      case 2:
        prevStatus = 1;
        break;
      case 3:
        prevStatus = 2;
        break;
      default:
        wx.showToast({
          title: '当前状态无法回退',
          icon: 'none'
        });
        return;
    }

    wx.showLoading({ title: '处理中...' });

    try {
      await adminApi.updateOrderStatus(this.data.orderNo, prevStatus);
      wx.hideLoading();
      wx.showToast({
        title: '状态已回退',
        icon: 'success'
      });
      // 刷新订单详情
      this.loadOrderDetail();
    } catch (err) {
      wx.hideLoading();
      console.error('回退订单状态失败:', err);
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    }
  },

  // 管理员操作：下一步（推进状态）
  async handleNextStep() {
    const currentStatus = this.data.orderInfo.status;
    let nextStatus;
    
    // 根据当前状态确定下一步状态
    // 0:待支付 -> 1:已支付
    // 1:已支付 -> 2:处理中
    // 2:处理中 -> 3:已完成
    // 3:已完成 -> 无下一步
    // 4:已取消 -> 无下一步
    switch (currentStatus) {
      case 0:
        nextStatus = 1;
        break;
      case 1:
        nextStatus = 2;
        break;
      case 2:
        nextStatus = 3;
        break;
      default:
        wx.showToast({
          title: '当前状态无法推进',
          icon: 'none'
        });
        return;
    }

    wx.showLoading({ title: '处理中...' });

    try {
      await adminApi.updateOrderStatus(this.data.orderNo, nextStatus);
      wx.hideLoading();
      wx.showToast({
        title: '状态已更新',
        icon: 'success'
      });
      // 刷新订单详情
      this.loadOrderDetail();
    } catch (err) {
      wx.hideLoading();
      console.error('推进订单状态失败:', err);
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    }
  },

  // 管理员操作：取消订单
  async handleAdminCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await adminApi.updateOrderStatus(this.data.orderNo, 4); // 4:已取消
            wx.hideLoading();
            wx.showToast({
              title: '订单已取消',
              icon: 'success'
            });
            // 刷新订单详情
            this.loadOrderDetail();
          } catch (err) {
            wx.hideLoading();
            console.error('取消订单失败:', err);
            wx.showToast({
              title: err.message || '取消失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 管理员操作：待收款状态回退到处理中（旧系统兼容）
  async handleRevertToProcessing() {
    wx.showModal({
      title: '确认操作',
      content: '确定要将订单状态回退到"处理中"吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await adminApi.updateOrderStatus(this.data.orderNo, 2); // 2:处理中
            wx.hideLoading();
            wx.showToast({
              title: '状态已回退',
              icon: 'success'
            });
            // 刷新订单详情
            this.loadOrderDetail();
          } catch (err) {
            wx.hideLoading();
            console.error('回退订单状态失败:', err);
            wx.showToast({
              title: err.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // ===== 双字段状态系统 - 新操作方法 =====

  /**
   * 管理员操作：开始处理（updateOrderFlowStatus -> PROCESSING）
   */
  handleStartProcessing() {
    this.updateOrderFlowStatus(ORDER_FLOW_STATUS.PROCESSING, '确认开始处理此订单？');
  },

  /**
   * 管理员操作：标记服务完成（updateOrderFlowStatus -> SERVICE_DONE）
   */
  handleMarkServiceDone() {
    this.updateOrderFlowStatus(ORDER_FLOW_STATUS.SERVICE_DONE, '确认服务已完成？');
  },

  /**
   * 管理员操作：确认收款（双字段系统 - updatePaymentStatus -> PAID）
   */
  handleConfirmPaymentNew() {
    wx.showModal({
      title: '确认收款',
      content: '确认已收到客户付款？',
      success: (res) => {
        if (res.confirm) {
          this.updatePaymentStatus(PAYMENT_STATUS.PAID);
        }
      }
    });
  },

  /**
   * 管理员操作：取消订单（双字段系统 - updateOrderFlowStatus -> CANCELLED）
   */
  handleCancelOrderNew() {
    this.updateOrderFlowStatus(ORDER_FLOW_STATUS.CANCELLED, '确认取消此订单？');
  },

  /**
   * 通用订单流程状态更新方法（双字段系统）
   */
  async updateOrderFlowStatus(newStatus, confirmMsg) {
    wx.showModal({
      title: '确认操作',
      content: confirmMsg,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const result = await wx.cloud.callFunction({
              name: 'orderManagement',
              data: {
                action: 'updateOrderFlowStatus',
                data: {
                  orderId: this.data.orderInfo._id,
                  orderStatus: newStatus
                }
              }
            });
            wx.hideLoading();
            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '操作成功', icon: 'success' });
              this.loadOrderDetail(); // 刷新详情
            } else {
              wx.showToast({ title: (result.result && result.result.message) || '操作失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('更新订单流程状态失败:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 通用支付状态更新方法（双字段系统）
   */
  async updatePaymentStatus(newStatus) {
    try {
      wx.showLoading({ title: '处理中...' });
      const result = await wx.cloud.callFunction({
        name: 'orderManagement',
        data: {
          action: 'updatePaymentStatus',
          data: {
            orderId: this.data.orderInfo._id,
            paymentStatus: newStatus,
            paymentMethod: 'offline' // 线下收款
          }
        }
      });
      wx.hideLoading();
      if (result.result && result.result.code === 0) {
        wx.showToast({ title: '收款确认成功', icon: 'success' });
        this.loadOrderDetail(); // 刷新详情
      } else {
        wx.showToast({ title: (result.result && result.result.message) || '操作失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('更新支付状态失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 旧系统兼容：确认收款（待收款状态变为已完成）
  async handleConfirmPayment() {
    wx.showModal({
      title: '确认收款',
      content: '确定已收到客户付款吗？确认后订单将变为"已完成"状态。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await adminApi.updateOrderStatus(this.data.orderNo, 3); // 3:已完成
            wx.hideLoading();
            wx.showToast({
              title: '收款确认成功',
              icon: 'success'
            });
            // 刷新订单详情
            this.loadOrderDetail();
          } catch (err) {
            wx.hideLoading();
            console.error('确认收款失败:', err);
            wx.showToast({
              title: err.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

});
