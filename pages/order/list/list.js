const { api } = require('../../../utils/api.js');
const {
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  getOrderFlowText,
  getPaymentStatusText,
  mapLegacyStatusToNew
} = require('../../../config/constants.js');
const { formatDate } = require('../../../utils/util.js');

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
    activeTab: '0',
    // 用户端标签页：更简洁的设计
    statusTabs: [
      { value: '0', label: '全部', filter: 'all' },
      { value: '1', label: '待付款', filter: 'unpaid' },       // paymentStatus=0 且 orderStatus<3
      { value: '2', label: '进行中', filter: 'processing' },   // orderStatus in [1, 2]
      { value: '3', label: '已完成', filter: 'completed' },    // orderStatus=3
      { value: '4', label: '已取消', filter: 'cancelled' }     // orderStatus=4
    ],
    searchKeyword: '',
    showFilterPanel: false,
    startDate: '',
    endDate: '',
    minPrice: '',
    maxPrice: '',
    filterApplied: false,
    systemType: 'white'
  },

  onLoad() {
    this.loadOrders();
  },

  onTabChange(e) {
    const value = e.detail.value;
    this.setData({
      activeTab: value,
      'pagination.page': 1,
      orders: [],
    }, () => {
      this.loadOrders();
    });
  },

  onTabClick(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      activeTab: value,
      'pagination.page': 1,
      orders: [],
      loading: true
    }, () => {
      this.loadOrders();
    });
  },

  onSearchChange(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  onSearchClear() {
    this.setData({
      searchKeyword: ''
    }, () => {
      this.loadOrders();
    });
  },

  onSearchConfirm() {
    this.setData({
      'pagination.page': 1,
      orders: [],
      loading: true
    }, () => {
      this.loadOrders();
    });
  },

  onFilterPopupChange(e) {
    this.setData({
      showFilterPanel: e.detail.visible
    });
  },

  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    });
  },

  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
  },

  onMinPriceChange(e) {
    this.setData({
      minPrice: e.detail.value
    });
  },

  onMaxPriceChange(e) {
    this.setData({
      maxPrice: e.detail.value
    });
  },

  resetFilter() {
    this.setData({
      startDate: '',
      endDate: '',
      minPrice: '',
      maxPrice: '',
      filterApplied: false
    });
  },

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
      const tab = this.data.statusTabs.find(t => t.value === this.data.activeTab);
      const filterParams = this.buildFilterParams(tab ? tab.filter : 'all');

      const params = {
        page,
        size,
        ...filterParams
      };

      if (this.data.searchKeyword) {
        params.keyword = this.data.searchKeyword;
      }

      if (this.data.startDate) {
        params.startDate = this.data.startDate;
      }
      if (this.data.endDate) {
        params.endDate = this.data.endDate;
      }

      if (this.data.minPrice) {
        params.minPrice = parseInt(this.data.minPrice) * 100;
      }
      if (this.data.maxPrice) {
        params.maxPrice = parseInt(this.data.maxPrice) * 100;
      }

      const data = await api.getUserOrders({
        ...params,
        page,
        size
      });

      if (!data || !data.records) {
        throw new Error('订单数据为空');
      }

      const { records, total } = data;

      if (records.length === 0 && page === 1) {
        this.setData({
          orders: [],
          loading: false
        });
        return;
      }

      // 处理订单数据，兼容旧数据
      const formattedOrders = records.map(order => {
        // 兼容旧数据：如果没有 orderStatus 字段，使用映射函数转换
        if (order.orderStatus === undefined) {
          const mapped = mapLegacyStatusToNew(order.status, order.payTime);
          order.orderStatus = mapped.orderStatus;
          order.paymentStatus = mapped.paymentStatus;
        }
        
        return {
          ...order,
          // 新系统的状态文本
          orderStatusText: getOrderFlowText(order.orderStatus),
          paymentStatusText: getPaymentStatusText(order.paymentStatus),
          createdTime: formatDate(order.createTime),
          serviceTime: formatDate(order.serviceTime),
          totalAmount: Number(order.totalAmount).toFixed(2)
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

  /**
   * 根据标签页 filter 构建查询参数
   * @param {string} filter - 筛选类型
   * @returns {Object} 查询参数
   */
  buildFilterParams(filter) {
    switch (filter) {
      case 'unpaid':
        // 待付款：未支付 + 未完成/取消的订单
        return {
          paymentStatus: PAYMENT_STATUS.UNPAID,
          orderStatusList: [
            ORDER_FLOW_STATUS.CREATED,
            ORDER_FLOW_STATUS.PROCESSING,
            ORDER_FLOW_STATUS.SERVICE_DONE
          ]
        };
      case 'processing':
        // 进行中：服务中或服务完成（不论支付状态）
        return {
          orderStatusList: [
            ORDER_FLOW_STATUS.PROCESSING,
            ORDER_FLOW_STATUS.SERVICE_DONE
          ]
        };
      case 'completed':
        // 已完成
        return {
          orderStatusList: [ORDER_FLOW_STATUS.COMPLETED]
        };
      case 'cancelled':
        // 已取消
        return {
          orderStatusList: [ORDER_FLOW_STATUS.CANCELLED]
        };
      case 'all':
      default:
        // 全部订单，不传状态筛选
        return {};
    }
  },

  onPullDownRefresh() {
    this.setData({
      'pagination.page': 1,
      orders: [],
      hasMore: true
    }, async () => {
      await this.loadOrders();
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadMore();
    }
  },

  formatOrderNoForDisplay(orderNo) {
    if (!orderNo) return orderNo;
    const match = orderNo.match(/^order_(\d{8})_(\d{3})$/);
    if (match) {
      return `ORD${match[1]}${match[2]}`;
    }
    return orderNo;
  },

  formatOrderNoForQuery(displayOrderNo) {
    if (!displayOrderNo) return displayOrderNo;
    const match = displayOrderNo.match(/^ORD(\d{8})(\d{3})$/);
    if (match) {
      return `order_${match[1]}_${match[2]}`;
    }
    return displayOrderNo;
  },

  onOrderClick(e) {
    const { orderid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderid}`
    });
  },

  // 线下结算确认
  handlePay(e) {
    const { id } = e.currentTarget.dataset;
    // 找到对应订单
    const order = this.data.orders.find(o => o._id === id);
    if (order) {
      wx.navigateTo({
        url: `/pages/order/detail/detail?orderNo=${order.orderNo}`
      });
    }
  },

  // 取消订单
  handleCancel(e) {
    const { id } = e.currentTarget.dataset;
    const order = this.data.orders.find(o => o._id === id);
    if (!order) return;

    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '取消中...' });
            await api.updateOrderFlowStatus(order.orderNo, ORDER_FLOW_STATUS.CANCELLED);
            wx.hideLoading();
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrders(false);
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

});