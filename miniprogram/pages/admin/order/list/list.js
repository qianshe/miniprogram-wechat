const { adminApi, callCloudFunction } = require('../../../../utils/api.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');
const {
  getOrderStatusText,
  ORDER_STATUS,
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  WORKFLOW_MILESTONE,
  getAdminWorkflowSummary,
  getOrderFlowText,
  getPaymentStatusDisplayText,
  shouldShowPaymentStatusTag,
  getTabByStatusParams: getTabByStatusParamsFromConstants,
  mapLegacyStatusToNew
} = require('../../../../config/constants.js');
const { formatDate } = require('../../../../utils/util.js');

function getLocalDayStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseServiceDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return getLocalDayStart(value);
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  }

  return getLocalDayStart(raw);
}

function getServiceUrgencyHint(serviceTime, workflowMilestone) {
  if (![WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE, WORKFLOW_MILESTONE.PROCESSING].includes(workflowMilestone)) {
    return '';
  }

  const targetDate = parseServiceDate(serviceTime);
  if (!targetDate) {
    return '未安排服务日';
  }

  const today = getLocalDayStart(new Date());
  if (!today) {
    return '';
  }

  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return '今日服务';
  if (diffDays === 1) return '明日服务';
  if (diffDays > 1) return `${diffDays}天后服务`;
  return `已过服务日 ${Math.abs(diffDays)} 天`;
}

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
    workflowMilestoneFilter: '',
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
    if (!this.checkAdminPermission()) {
      return;
    }

    if (options.workflowMilestone) {
      const workflowMilestoneFilter = this.normalizeWorkflowMilestoneFilter(options.workflowMilestone);
      this.setData({
        workflowMilestoneFilter,
        activeTab: this.getTabByWorkflowMilestoneFilter(workflowMilestoneFilter)
      });
    }
    
    // 处理从统计页面跳转过来的筛选参数
    if (options.orderStatus !== undefined || options.paymentStatus !== undefined) {
      const activeTab = this.getTabByStatusParams(options.orderStatus, options.paymentStatus);
      this.setData({ activeTab });
    }
    
    this.loadOrders();
  },
  
  // 根据 orderStatus 和 paymentStatus 参数获取对应的 tab
  getTabByStatusParams(orderStatus, paymentStatus) {
    if (orderStatus === undefined || orderStatus === null || orderStatus === '') {
      return '0';
    }

    const normalizedOrderStatus = parseInt(orderStatus, 10);
    const normalizedPaymentStatus = paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== ''
      ? parseInt(paymentStatus, 10)
      : null;

    if (normalizedOrderStatus === ORDER_FLOW_STATUS.CREATED) {
      return normalizedPaymentStatus === PAYMENT_STATUS.PAID ? '2' : '1';
    }

    return getTabByStatusParamsFromConstants(orderStatus, paymentStatus);
  },

  normalizeWorkflowMilestoneFilter(rawValue) {
    if (!rawValue) {
      return '';
    }

    let decodedValue = String(rawValue);
    try {
      decodedValue = decodeURIComponent(decodedValue);
    } catch (error) {
      decodedValue = String(rawValue);
    }

    const values = decodedValue
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    return values.length > 1 ? values : (values[0] || '');
  },

  getTabByWorkflowMilestoneFilter(filter) {
    const values = Array.isArray(filter) ? filter : [filter];

    if (values.includes(WORKFLOW_MILESTONE.UNCLAIMED) || values.includes(WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED)) {
      return '1';
    }
    if (values.includes(WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE)) {
      return '2';
    }
    if (values.includes(WORKFLOW_MILESTONE.PROCESSING)) {
      return '3';
    }
    if (values.includes(WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID)) {
      return '4';
    }
    if (values.includes(WORKFLOW_MILESTONE.COMPLETED)) {
      return '5';
    }
    if (values.includes(WORKFLOW_MILESTONE.CANCELLED)) {
      return '6';
    }

    return '0';
  },

  checkAdminPermission() {
    return checkAdminAccess();
  },

  // 标签页点击
  onTabClick(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      activeTab: value,
      workflowMilestoneFilter: '',
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

  // 根据标签页获取 orderStatus 和 paymentStatus 组合（与统计页面保持一致）
  getStatusByTab(tab) {
    const tabToOrderStatus = {
      '1': ORDER_FLOW_STATUS.CREATED,
      '2': ORDER_FLOW_STATUS.CREATED,
      '3': ORDER_FLOW_STATUS.PROCESSING,
      '4': ORDER_FLOW_STATUS.SERVICE_DONE,
      '5': ORDER_FLOW_STATUS.COMPLETED,
      '6': ORDER_FLOW_STATUS.CANCELLED
    };

    if (!Object.prototype.hasOwnProperty.call(tabToOrderStatus, tab)) {
      return { orderStatus: null, paymentStatus: null };
    }

    return { orderStatus: tabToOrderStatus[tab], paymentStatus: null };
  },

  getWorkflowMilestoneFilterByTab(tab) {
    const tabFilters = {
      '1': [WORKFLOW_MILESTONE.UNCLAIMED, WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED],
      '2': [WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE],
      '3': [WORKFLOW_MILESTONE.PROCESSING],
      '4': [WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID],
      '5': [WORKFLOW_MILESTONE.COMPLETED],
      '6': [WORKFLOW_MILESTONE.CANCELLED]
    };
    return tabFilters[tab] || null;
  },

  async loadOrders(isLoadMore = false) {
    if (!isLoadMore) {
      this.setData({ loading: true });
    }

    try {
      const { page, size } = this.data.pagination;
      // 根据标签页状态过滤订单（使用 orderStatus + paymentStatus 组合）
      const statusFilter = this.getStatusByTab(this.data.activeTab);
      const workflowMilestoneFilter = this.data.workflowMilestoneFilter;
      const tabMilestoneFilter = this.getWorkflowMilestoneFilterByTab(this.data.activeTab);
      const effectiveFilter = workflowMilestoneFilter || tabMilestoneFilter;
      
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

      if (effectiveFilter) {
        if (Array.isArray(effectiveFilter)) {
          params.workflowMilestoneList = effectiveFilter;
        } else {
          params.workflowMilestone = effectiveFilter;
        }
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

        const summary = getAdminWorkflowSummary({ ...order, orderStatus: os, paymentStatus: ps });
        const milestone = summary.workflowMilestone;
        const milestoneText = summary.workflowMilestoneText;
        const allowStartService = summary.canStartService;
        const serviceUrgencyHint = getServiceUrgencyHint(order.serviceTime, milestone);

        const showActionStartService = allowStartService && os === ORDER_FLOW_STATUS.CREATED;
        const showActionProcessing = os === ORDER_FLOW_STATUS.PROCESSING;
        const showActionServiceDoneUnpaid = os === ORDER_FLOW_STATUS.SERVICE_DONE && ps === PAYMENT_STATUS.UNPAID;
        const showActionServiceDonePaid = os === ORDER_FLOW_STATUS.SERVICE_DONE && ps === PAYMENT_STATUS.PAID;
        const showCancelButton = os !== ORDER_FLOW_STATUS.COMPLETED && os !== ORDER_FLOW_STATUS.CANCELLED;

        const flowText = os === ORDER_FLOW_STATUS.CREATED
          ? milestoneText
          : getOrderFlowText(os);

        return {
          ...order,
          workflowMilestone: milestone,
          workflowMilestoneText: milestoneText,
          orderStatusText: hasNewFields
            ? flowText
            : getOrderStatusText(order.status),
          paymentStatusText: getPaymentStatusDisplayText(os, ps, true),
          showPaymentStatusTag: shouldShowPaymentStatusTag(os),
          serviceUrgencyHint,
          showServiceUrgencyHint: !!serviceUrgencyHint,
          serviceUrgencyLevel: serviceUrgencyHint.includes('已过') ? 'overdue' : (serviceUrgencyHint === '今日服务' ? 'today' : ''),
          statusText: hasNewFields
            ? flowText
            : getOrderStatusText(order.status),
          createdTime: formatDate(order.createTime),
          serviceTime: formatDate(order.serviceTime) || '未指定',
          totalAmount: order.totalAmount.toFixed(2),
          showActionStartService,
          showActionProcessing,
          showActionServiceDoneUnpaid,
          showActionServiceDonePaid,
          showCancelButton,
          actionOrderFlowStatus: showActionStartService
            ? ORDER_FLOW_STATUS.PROCESSING
            : showActionProcessing
              ? ORDER_FLOW_STATUS.SERVICE_DONE
              : showActionServiceDonePaid
                ? ORDER_FLOW_STATUS.COMPLETED
                : showCancelButton
                  ? ORDER_FLOW_STATUS.CANCELLED
                  : null
        };
      });

      const filteredOrders = effectiveFilter
        ? formattedOrders.filter(order => Array.isArray(effectiveFilter)
          ? effectiveFilter.includes(order.workflowMilestone)
          : order.workflowMilestone === effectiveFilter)
        : formattedOrders;

      this.setData({
        orders: isLoadMore ? [...this.data.orders, ...filteredOrders] : filteredOrders,
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

  /**
   * 基于新 orderStatus 的流程状态推进（Phase 5 active cleanup）
   */
  async updateOrderFlow(e) {
    const { orderid, orderno, orderflowstatus } = e.currentTarget.dataset;
    try {
      wx.showLoading({ title: '处理中...' });
      await adminApi.updateOrderFlowStatus(orderid, parseInt(orderflowstatus, 10));
      wx.hideLoading();
      wx.showToast({ title: '更新成功' });
      this.setData({
        'pagination.page': 1,
        orders: []
      }, () => {
        this.loadOrders();
      });
    } catch (error) {
      console.error('更新订单流程状态失败:', { orderNo: orderno, orderId: orderid, error });
      wx.hideLoading();
      wx.showToast({
        title: error.message || error.result?.message || '更新失败',
        icon: 'none'
      });
    }
  },

  /**
   * 开始服务（基于新 orderStatus 流程推进）
   */
  async startService(e) {
    const { orderno, orderid } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认操作',
      content: '确认开始为客户提供服务？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await adminApi.updateOrderFlowStatus(orderid, ORDER_FLOW_STATUS.PROCESSING);
            wx.hideLoading();
            wx.showToast({ title: '已开始服务' });
            this.setData({ 'pagination.page': 1, orders: [] }, () => this.loadOrders());
          } catch (error) {
            console.error('开始服务失败:', { orderNo: orderno, orderId: orderid, error });
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
      url: '/pages/admin/order/create-entry/create-entry'
    });
  }
});
