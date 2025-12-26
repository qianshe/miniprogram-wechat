const { api } = require('../../../utils/api.js');
const { getOrderStatusText } = require('../../../config/constants.js');
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
    statusTabs: [
      { value: '0', label: '全部' },
      { value: '1', label: '待支付' },
      { value: '2', label: '已支付' },
      { value: '3', label: '处理中' },
      { value: '4', label: '已完成' },
      { value: '5', label: '已取消' }
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
      const status = this.getStatusByTab(this.data.activeTab);

      const params = {
        page,
        size,
        ...(status !== undefined ? { status } : {})
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

      const formattedOrders = records.map(order => ({
        ...order,
        statusText: getOrderStatusText(order.status),
        createdTime: formatDate(order.createTime),
        serviceTime: formatDate(order.serviceTime),
        totalAmount: Number(order.totalAmount).toFixed(2)
      }));

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

  getStatusByTab(tab) {
    const statusMap = {
      '0': undefined,
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      '5': 4
    };
    return statusMap[tab];
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

});
