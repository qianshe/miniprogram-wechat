const { adminApi } = require('../../../../utils/api.js');
const auth = require('../../../../utils/auth.js');

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
    filterApplied: false,
    isAdmin: true
  },

  onLoad() {
    // 检查管理员权限
    this.checkAdminPermission();
    this.loadOrders();
  },

  checkAdminPermission() {
    if (!auth.checkAuth()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        });
      }, 1500);
      return;
    }

    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'admin') {
      wx.showToast({
        title: '无管理员权限',
        icon: 'none'
      });
      setTimeout(() => {
        wx.switchTab({
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
      // 根据标签页状态过滤订单
      const orderStatus = this.getStatusByTab(this.data.activeTab);
      
      const params = {
        page,
        size,
        ...(orderStatus !== undefined ? { orderStatus } : {})
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

      // 调用统一API获取管理员订单列表
      const data = await adminApi.getOrders({
        ...params,
        page,
        size,
        status: params.orderStatus // 使用orderStatus作为状态筛选
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
      2: '处理中',
      3: '已完成',
      4: '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  getStatusByTab(tab) {
    const statusMap = {
      '0': undefined, // 全部
      '1': 0,        // 待支付
      '2': 1,        // 已支付
      '3': 2,        // 处理中
      '4': 3,        // 已完成
      '5': 4         // 已取消
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

  onOrderClick(e) {
    const { orderid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderid}&isAdmin=true`
    });
  },



  // 修改订单状态
  async updateOrderStatus(e) {
    const { orderid, status } = e.currentTarget.dataset;
    try {
      wx.showLoading({ title: '处理中...' });

      // 调用统一API更新订单状态
      await adminApi.updateOrderStatus(orderid, parseInt(status));

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
      wx.showToast({
        title: error.message || error.result?.message || '更新失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
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