const { api } = require('../../../utils/api.js');
const {
  ORDER_FLOW_STATUS,
  WORKFLOW_MILESTONE,
  getWorkflowMilestone,
  getWorkflowMilestoneText,
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
    // 用户端标签页：服务记录语义
    statusTabs: [
      { value: '0', label: '全部', filter: 'all' },
      { value: '1', label: '待确认', filter: 'claimed-unconfirmed' },
      { value: '2', label: '待服务', filter: 'confirmed-ready' },
      { value: '3', label: '服务中', filter: 'processing' },
      { value: '4', label: '待付款', filter: 'pending-payment' },
      { value: '5', label: '已完成', filter: 'completed' }
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
      searchKeyword: '',
      'pagination.page': 1,
      orders: [],
      hasMore: true,
      loading: true
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

  getUserFacingStatusText(order) {
    const normalizedOrderStatus = Number(order.orderStatus);
    if (normalizedOrderStatus === ORDER_FLOW_STATUS.CANCELLED) {
      return '已完成';
    }
    if (normalizedOrderStatus === ORDER_FLOW_STATUS.COMPLETED) {
      return '已完成';
    }
    if (normalizedOrderStatus === ORDER_FLOW_STATUS.PROCESSING) {
      return '服务中';
    }
    if (normalizedOrderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) {
      return '待付款';
    }
    if (normalizedOrderStatus === ORDER_FLOW_STATUS.CREATED) {
      const milestone = getWorkflowMilestone(order);
      if (milestone === WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE) {
        return '待服务';
      }
      if (milestone === WORKFLOW_MILESTONE.UNCLAIMED) {
        return getWorkflowMilestoneText(milestone);
      }
      return '待确认';
    }
    return '待确认';
  },

  async loadOrders(isLoadMore = false) {
    if (!isLoadMore) {
      this.setData({ loading: true });
    }

    try {
      const { page, size } = this.data.pagination;
      const tab = this.data.statusTabs.find(t => t.value === this.data.activeTab);
      const currentFilter = tab ? tab.filter : 'all';
      const filterParams = this.buildFilterParams(currentFilter);

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

      const data = await api.getUserOrders({
        ...params,
        page,
        size
      });

      if (!data || !data.records) {
        throw new Error('记录数据为空');
      }

      const { records, total } = data;

      if (records.length === 0 && page === 1) {
        this.setData({
          orders: [],
          loading: false
        });
        return;
      }

      const formattedOrders = records.map(order => {
        if (order.orderStatus === undefined) {
          const mapped = mapLegacyStatusToNew(order.status, order.payTime);
          order.orderStatus = mapped.orderStatus;
          order.paymentStatus = mapped.paymentStatus;
        }

        const workflowMilestone = getWorkflowMilestone(order);

        return {
          ...order,
          workflowMilestone,
          workflowMilestoneText: getWorkflowMilestoneText(workflowMilestone),
          orderStatusText: this.getUserFacingStatusText(order),
          showPaymentStatusTag: false,
          createdTime: formatDate(order.createTime),
          serviceTime: formatDate(order.serviceTime) || '未指定',
          totalAmount: Number(order.totalAmount || 0).toFixed(2)
        };
      });

      const filteredOrders = this.filterOrdersByMilestone(formattedOrders, currentFilter);

      this.setData({
        orders: isLoadMore ? [...this.data.orders, ...filteredOrders] : filteredOrders,
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
      case 'claimed-unconfirmed':
      case 'confirmed-ready':
        return {
          orderStatusList: [ORDER_FLOW_STATUS.CREATED]
        };
      case 'processing':
        return {
          orderStatusList: [ORDER_FLOW_STATUS.PROCESSING]
        };
      case 'pending-payment':
        return {
          orderStatusList: [ORDER_FLOW_STATUS.SERVICE_DONE]
        };
      case 'completed':
        return {
          orderStatusList: [ORDER_FLOW_STATUS.COMPLETED, ORDER_FLOW_STATUS.CANCELLED]
        };
      case 'all':
      default:
        return {};
    }
  },

  filterOrdersByMilestone(orders, filter) {
    if (!Array.isArray(orders) || !orders.length) return orders;
    if (filter === 'claimed-unconfirmed') {
      return orders.filter(order => order.workflowMilestone === WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED);
    }
    if (filter === 'confirmed-ready') {
      return orders.filter(order => order.workflowMilestone === WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE);
    }
    return orders;
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
    const match = orderNo.match(/^(?:order|record)_(\d{8})_(\d{3})$/);
    if (match) {
      return `REC${match[1]}${match[2]}`;
    }
    return orderNo;
  },

  formatOrderNoForQuery(displayOrderNo) {
    if (!displayOrderNo) return displayOrderNo;
    const match = displayOrderNo.match(/^REC(\d{8})(\d{3})$/);
    if (match) {
      return `record_${match[1]}_${match[2]}`;
    }
    return displayOrderNo;
  },

  onOrderClick(e) {
    const { orderid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderid}`
    });
  },

  handleCancel() {
    wx.showToast({
      title: '当前记录仅支持查看',
      icon: 'none'
    });
  },
});
