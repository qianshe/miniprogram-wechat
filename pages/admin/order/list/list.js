const { adminApi, callCloudFunction } = require('../../../../utils/api.js');
const auth = require('../../../../utils/auth.js');
const {
  getOrderStatusText,
  ORDER_STATUS,
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  getOrderFlowText,
  getPaymentStatusDisplayText,
  shouldShowPaymentStatusTag,
  getTabByStatusParams: getTabByStatusParamsFromConstants,
  getStatusByTabIndex,
  mapLegacyStatusToNew
} = require('../../../../config/constants.js');
const { formatDate } = require('../../../../utils/util.js');

Page({
  data: {
    orders: [],
    loading: true,
    pagination: {
      page: 1,
      size: 10,
      total: 0
    },
    hasMore: true,
    activeTab: '0', // 当前激活的标签页（与统计页状态对应）
    // 搜索和筛选相关数据
    searchKeyword: '',
    showFilterPanel: false,
    startDate: '',
    endDate: '',
    minPrice: '',
    maxPrice: '',
    filterApplied: false,
    isAdmin: true
  },

  onLoad(options) {
    // 检查管理员权限
    this.checkAdminPermission();
    
    // 处理从统计页面跳转过来的筛选参数
    if (options.orderStatus !== undefined || options.paymentStatus !== undefined) {
      const activeTab = this.getTabByStatusParams(options.orderStatus, options.paymentStatus);
      this.setData({ activeTab });
    }
    
    this.loadOrders();
  },
  
  // 根据 orderStatus 和 paymentStatus 参数获取对应的 tab
  getTabByStatusParams(orderStatus, paymentStatus) {
    return getTabByStatusParamsFromConstants(orderStatus, paymentStatus);
  },

  checkAdminPermission() {
    if (!auth.checkAuth()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/admin/login/login'
        });
      }, 1500);
      return;
    }

    const userInfo = wx.getStorageSync('userInfo');
    // 修复：role 是数字类型，1表示管理员；或者直接检查 isAdmin 字段
    if (!userInfo || (userInfo.role !== 1 && !userInfo.isAdmin)) {
      wx.showToast({
        title: '无管理员权限',
        icon: 'none'
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index_home/index_home'
        });
      }, 1500);
    }
  },

  // 标签页点击
  onTabClick(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      activeTab: value,
      'pagination.page': 1,  // 重置页码
      orders: [],  // 清空当前订单列表
      loading: true
    }, () => {
      this.loadOrders();  // 重新加载订单
    });
  },

  // TDesign搜索框变化
  onSearchChange(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // TDesign搜索框清空
  onSearchClear() {
    this.setData({
      searchKeyword: ''
    }, () => {
      this.loadOrders();
    });
  },

  // 搜索确认
  onSearchConfirm() {
    this.setData({
      'pagination.page': 1,
      orders: [],
      loading: true
    }, () => {
      this.loadOrders();
    });
  },

  // TDesign弹窗显示状态变化
  onFilterPopupChange(e) {
    this.setData({
      showFilterPanel: e.detail.visible
    });
  },

  // 切换筛选面板
  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    });
  },

  // 开始日期变化
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
  },

  // 结束日期变化
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
  },

  // 最低价格变化
  onMinPriceChange(e) {
    this.setData({
      minPrice: e.detail.value
    });
  },

  // 最高价格变化
  onMaxPriceChange(e) {
    this.setData({
      maxPrice: e.detail.value
    });
  },

  // 重置筛选条件
  resetFilter() {
    this.setData({
      startDate: '',
      endDate: '',
      minPrice: '',
      maxPrice: '',
      filterApplied: false
    });
  },

  // 应用筛选条件
  applyFilter() {
    this.setData({
      showFilterPanel: false,
      filterApplied: true,
      'pagination.page': 1,
      orders: [],
      loading: true
    }, () => {
      this.loadOrders();
    });
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore) {
      this.setData({
        'pagination.page': this.data.pagination.page + 1
      }, () => {
        this.loadOrders(true);
      });
    }
  },

  async loadOrders(isLoadMore = false) {
    if (!isLoadMore) {
      this.setData({ loading: true });
    }

    try {
      const { page, size } = this.data.pagination;
      // 根据标签页状态过滤订单（使用 orderStatus + paymentStatus 组合）
      const statusFilter = this.getStatusByTab(this.data.activeTab);
      
      const params = {
        page,
        size
      };

      // 添加 orderStatus 筛选
      if (statusFilter.orderStatus !== null && statusFilter.orderStatus !== undefined) {
        params.orderStatus = statusFilter.orderStatus;
      }

      // 添加 paymentStatus 筛选
      if (statusFilter.paymentStatus !== null && statusFilter.paymentStatus !== undefined) {
        params.paymentStatus = statusFilter.paymentStatus;
      }

      // 添加搜索关键词
      if (this.data.searchKeyword) {
        params.keyword = this.data.searchKeyword;
      }

      // 添加日期筛选
      if (this.data.startDate) {
        params.startDate = this.data.startDate;
      }
      if (this.data.endDate) {
        params.endDate = this.data.endDate;
      }

      // 添加价格筛选
      if (this.data.minPrice) {
        params.minPrice = parseInt(this.data.minPrice) * 100; // 转换为分
      }
      if (this.data.maxPrice) {
        params.maxPrice = parseInt(this.data.maxPrice) * 100; // 转换为分
      }

      // 调用统一API获取管理员订单列表
      const data = await adminApi.getOrders({
        ...params,
        page,
        size
      });

      const { records, total } = data;

      // 如果云数据库没有数据，显示空状态
      if (records.length === 0 && page === 1) {
        this.setData({
          orders: [],
          loading: false
        });
        return;
      }

      // 处理订单数据，添加双状态文本和操作标志
      const formattedOrders = records.map(order => {
        const hasNewFields = order.orderStatus !== undefined && order.orderStatus !== null;
        const normalized = hasNewFields
          ? { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus }
          : mapLegacyStatusToNew(order.status, order.payTime);
        const os = normalized.orderStatus;
        const ps = normalized.paymentStatus;

        const showActionCreatedUnpaid = os === ORDER_FLOW_STATUS.CREATED && ps === PAYMENT_STATUS.UNPAID;
        const showActionCreatedPaid = os === ORDER_FLOW_STATUS.CREATED && ps === PAYMENT_STATUS.PAID;
        const showActionProcessing = os === ORDER_FLOW_STATUS.PROCESSING;
        const showActionServiceDoneUnpaid = os === ORDER_FLOW_STATUS.SERVICE_DONE && ps === PAYMENT_STATUS.UNPAID;
        const showActionServiceDonePaid = os === ORDER_FLOW_STATUS.SERVICE_DONE && ps === PAYMENT_STATUS.PAID;
        const showCancelButton = os !== ORDER_FLOW_STATUS.COMPLETED && os !== ORDER_FLOW_STATUS.CANCELLED;

        return {
          ...order,
          orderStatusText: hasNewFields
            ? getOrderFlowText(order.orderStatus)
            : getOrderStatusText(order.status),
          paymentStatusText: getPaymentStatusDisplayText(os, ps, true),
          showPaymentStatusTag: shouldShowPaymentStatusTag(os),
          statusText: hasNewFields
            ? getOrderFlowText(order.orderStatus)
            : getOrderStatusText(order.status),
          createdTime: formatDate(order.createTime),
          serviceTime: formatDate(order.serviceTime),
          totalAmount: order.totalAmount.toFixed(2),
          showActionCreatedUnpaid,
          showActionCreatedPaid,
          showActionProcessing,
          showActionServiceDoneUnpaid,
          showActionServiceDonePaid,
          showCancelButton
        };
      });

      this.setData({
        orders: isLoadMore ? [...this.data.orders, ...formattedOrders] : formattedOrders,
        'pagination.total': total,
        hasMore: page * size < total,
        loading: false
      });
    } catch (err) {
      console.error('云函数调用失败:', err);
      // 云函数调用失败时，显示错误提示
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({
        orders: [],
        loading: false
      });
    }
  },

  // 根据标签页获取 orderStatus 和 paymentStatus 组合（与统计页面保持一致）
  getStatusByTab(tab) {
    return getStatusByTabIndex(tab);
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadMore();
    }
  },

  /**
   * 页面下拉刷新处理
   */
  onPullDownRefresh() {
    // 重置分页参数，在回调中加载数据以确保状态已更新
    this.setData({
      'pagination.page': 1,
      orders: [],
      hasMore: true
    }, async () => {
      try {
        // 重新加载订单数据
        await this.loadOrders();
      } finally {
        // 无论成功与否，都要停止下拉刷新动画
        wx.stopPullDownRefresh();
      }
    });
  },

  onOrderClick(e) {
    const { orderno } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderno}&isAdmin=true`
    });
  },



  // 修改订单状态
  async updateOrderStatus(e) {
    const { orderno, status } = e.currentTarget.dataset;
    try {
      wx.showLoading({ title: '处理中...' });

      await adminApi.updateOrderStatus(orderno, parseInt(status));

      wx.hideLoading();
      wx.showToast({ title: '更新成功' });
      // 刷新当前订单列表
      this.setData({
        'pagination.page': 1,
        orders: [],
      }, () => {
        this.loadOrders();
      });
    } catch (error) {
      console.error('更新订单状态失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || error.result?.message || '更新失败',
        icon: 'none'
      });
    }
  },

  /**
   * 开始服务（未支付状态下开始服务）
   * 将订单状态从待服务改为服务中
   */
  async startService(e) {
    const { orderno } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认操作',
      content: '确认开始为客户提供服务？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await adminApi.updateOrderStatus(orderno, ORDER_STATUS.PROCESSING);
            wx.hideLoading();
            wx.showToast({ title: '已开始服务' });
            this.setData({ 'pagination.page': 1, orders: [] }, () => this.loadOrders());
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: error.message || '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 确认线下收款
   */
  async recordOfflinePayment(e) {
    const { orderno } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认收款',
      content: '确认已收到客户的线下付款？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await callCloudFunction('orderManagement', 'recordOfflinePayment', { orderNo: orderno });
            wx.hideLoading();
            wx.showToast({ title: '收款已确认' });
            setTimeout(() => {
              this.setData({ 'pagination.page': 1, orders: [] }, () => this.loadOrders());
            }, 300);
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: error.message || '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 跳转到创建订单页面
   */
  navigateToCreate() {
    wx.navigateTo({
      url: '/pages/admin/order/create/create'
    });
  }
});
