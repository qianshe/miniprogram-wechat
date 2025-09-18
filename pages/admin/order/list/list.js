const request = require('../../../../utils/request.js');
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

      // 调用云函数获取管理员订单列表
      const res = await wx.cloud.callFunction({
        name: 'orderManagement',
        data: {
          action: 'getOrders',
          data: {
            ...params,
            page,
            size,
            isAdmin: true,
            status: params.orderStatus // 使用orderStatus作为状态筛选
          }
        }
      });

      if (res.result.code === 200 && res.result.data) {
        const { records, total } = res.result.data;

        // 如果云数据库没有数据，使用本地存储的模拟数据
        if (records.length === 0 && page === 1) {
          this.loadMockOrders();
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
      }
    } catch (err) {
      console.error('云函数调用失败，使用本地数据:', err);
      // 云函数调用失败时，使用本地存储的模拟数据
      this.loadMockOrders();
    } finally {
      this.setData({ loading: false });
    }
  },

  getStatusText(status) {
    const statusMap = {
      0: '待支付',
      1: '已支付',
      2: '已取消',
      3: '已退款',
      4: '待确认',
      5: '已完成'
    };
    return statusMap[status] || '未知状态';
  },

  getStatusByTab(tab) {
    const statusMap = {
      '0': undefined, // 全部
      '1': 0,        // 待支付
      '2': 1,        // 已支付
      '3': 2,        // 已取消
      '4': 3,        // 已退款
      '5': 4,        // 待确认
      '6': 5         // 已完成
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
    const { orderno } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail/detail?orderNo=${orderno}&isAdmin=true`
    });
  },

  // 加载本地模拟订单数据
  loadMockOrders() {
    const mockOrders = [
      {
        _id: 'mock_admin_order_1',
        orderNo: 'ORD202412170001',
        status: 1,
        totalAmount: 1288.00,
        createTime: new Date().toISOString(),
        serviceTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        contactName: '张先生',
        contactPhone: '13800138000',
        serviceAddress: '北京市朝阳区某某街道',
        userOpenid: 'mock_openid_1',
        items: [
          {
            productId: 'prod_001',
            productName: '白事服务套餐A',
            price: 888.00,
            quantity: 1,
            subtotal: 888.00
          },
          {
            productId: 'prod_002',
            productName: '花圈',
            price: 200.00,
            quantity: 2,
            subtotal: 400.00
          }
        ]
      },
      {
        _id: 'mock_admin_order_2',
        orderNo: 'ORD202412170002',
        status: 0,
        totalAmount: 2588.00,
        createTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        serviceTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        contactName: '李女士',
        contactPhone: '13900139000',
        serviceAddress: '上海市浦东新区某某路',
        userOpenid: 'mock_openid_2',
        items: [
          {
            productId: 'prod_003',
            productName: '红事服务套餐B',
            price: 1888.00,
            quantity: 1,
            subtotal: 1888.00
          },
          {
            productId: 'prod_004',
            productName: '婚庆布置',
            price: 700.00,
            quantity: 1,
            subtotal: 700.00
          }
        ]
      },
      {
        _id: 'mock_admin_order_3',
        orderNo: 'ORD202412170003',
        status: 4,
        totalAmount: 3888.00,
        createTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        serviceTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        contactName: '王先生',
        contactPhone: '13700137000',
        serviceAddress: '广州市天河区某某大道',
        userOpenid: 'mock_openid_3',
        items: [
          {
            productId: 'prod_005',
            productName: '豪华白事套餐',
            price: 3888.00,
            quantity: 1,
            subtotal: 3888.00
          }
        ]
      }
    ];

    // 根据当前标签页过滤订单
    const statusFilter = this.getStatusByTab(this.data.activeTab);
    const filteredOrders = statusFilter !== undefined
      ? mockOrders.filter(order => order.status === statusFilter)
      : mockOrders;

    const formattedOrders = filteredOrders.map(order => ({
      ...order,
      statusText: this.getStatusText(order.status),
      createdTime: this.formatDate(order.createTime),
      serviceTime: this.formatDate(order.serviceTime),
      totalAmount: order.totalAmount.toFixed(2)
    }));

    this.setData({
      orders: formattedOrders,
      'pagination.total': filteredOrders.length,
      hasMore: false,
      loading: false
    });
  },

  // 修改订单状态
  async updateOrderStatus(e) {
    const { orderno, status } = e.currentTarget.dataset;
    try {
      wx.showLoading({ title: '处理中...' });

      // 调用云函数更新订单状态
      const res = await wx.cloud.callFunction({
        name: 'orderManagement',
        data: {
          action: 'updateOrderStatus',
          data: {
            orderNo: orderno,
            status: parseInt(status),
            isAdmin: true
          }
        }
      });

      if (res.result.code === 200) {
        wx.showToast({ title: '更新成功' });
        // 刷新当前订单列表
        this.setData({
          'pagination.page': 1,
          orders: [],
        }, () => {
          this.loadOrders();
        });
      } else {
        throw new Error(res.result.message || '更新失败');
      }
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