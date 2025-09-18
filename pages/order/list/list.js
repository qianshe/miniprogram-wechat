const { api } = require('../../../utils/api.js');

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
    activeTab: '0', // 当前激活的标签页
    // 搜索和筛选相关数据
    searchKeyword: '',
    showFilterPanel: false,
    startDate: '',
    endDate: '',
    minPrice: '',
    maxPrice: '',
    filterApplied: false
  },

  onLoad() {
    this.loadOrders();
  },

  // TDesign标签页变化
  onTabChange(e) {
    const value = e.detail.value;
    this.setData({
      activeTab: value,
      'pagination.page': 1,  // 重置页码
      orders: [],  // 清空当前订单列表
    }, () => {
      this.loadOrders();  // 重新加载订单
    });
  },

  // 保留原方法以兼容其他调用
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

  // TDesign输入框 - 最低价格变化
  onMinPriceChange(e) {
    this.setData({
      minPrice: e.detail.value
    });
  },

  // TDesign输入框 - 最高价格变化
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
      // 根据标签页状态过滤订单
      const orderStatus = this.getStatusByTab(this.data.activeTab);
      
      const params = {
        page,
        size,
        ...(orderStatus !== undefined ? { orderStatus } : {})  // 使用新的 orderStatus 参数
      };

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

      // 调用统一API获取订单列表
      const data = await api.getUserOrders({
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

        const formattedOrders = records.map(order => ({
          ...order,
          statusText: this.getStatusText(order.status),
          createdTime: this.formatDate(order.createTime),
          serviceTime: this.formatDate(order.serviceTime),
          totalAmount: order.totalAmount.toFixed(2) // 云函数已转换为元
        }));

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

  getStatusText(status) {
    const statusMap = {
      0: '待支付',
      1: '已支付',
      2: '已取消',
      3: '已退款'
    };
    return statusMap[status] || '未知状态';
  },

  getStatusByTab(tab) {
    const statusMap = {
      '0': undefined, // 全部
      '1': 0,        // 待支付
      '2': 1,        // 已支付
      '3': 2,        // 已取消
      '4': 3         // 已退款
    };
    return statusMap[tab];
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadMore();
    }
  },

  // 转换订单号显示格式：order_20240101_001 -> ORD20240101001
  formatOrderNoForDisplay(orderNo) {
    if (!orderNo) return orderNo;
    // 匹配格式：order_YYYYMMDD_XXX
    const match = orderNo.match(/^order_(\d{8})_(\d{3})$/);
    if (match) {
      return `ORD${match[1]}${match[2]}`;
    }
    return orderNo; // 如果格式不匹配，返回原值
  },

  // 转换显示格式的订单号回数据库格式：ORD20240101001 -> order_20240101_001
  formatOrderNoForQuery(displayOrderNo) {
    if (!displayOrderNo) return displayOrderNo;
    // 匹配格式：ORDYYYYMMDDXXX
    const match = displayOrderNo.match(/^ORD(\d{8})(\d{3})$/);
    if (match) {
      return `order_${match[1]}_${match[2]}`;
    }
    return displayOrderNo; // 如果格式不匹配，返回原值
  },

  onOrderClick(e) {
    const { orderid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderid}`
    });
  },


});
