const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    adminInfo: {
      avatar: 'https://img.yzcdn.cn/vant/cat.jpeg',
      name: '管理员',
      role: '超级管理员'
    },
    modules: [
      {
        id: 'order',
        name: '订单管理',
        icon: '📋',
        desc: '查看和管理所有订单',
        path: '/pages/admin/order/list/list'
      },
      {
        id: 'product',
        name: '商品管理',
        icon: '📦',
        desc: '管理商品信息和库存',
        path: '/pages/admin/product/list/list'
      },
      {
        id: 'create-order',
        name: '创建订单',
        icon: '➕',
        desc: '为客户创建新订单',
        path: '/pages/admin/order/create/create'
      },
      {
        id: 'scan',
        name: '扫码管理',
        icon: '📱',
        desc: '扫描商品或订单二维码',
        path: '/pages/admin/product/scan/scan'
      }
    ],
    // 今日数据统计
    todayStats: {
      orders: 0,
      sales: 0,
      products: 0,
      revenue: 0
    },
    loading: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadTodayStats();
  },

  onShow() {
    this.loadTodayStats();
  },

  onPullDownRefresh() {
    this.loadTodayStats();
    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    }, 1000);
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        adminInfo: {
          ...this.data.adminInfo,
          name: userInfo.nickName || '管理员',
          avatar: userInfo.avatarUrl || this.data.adminInfo.avatar
        }
      });
    }
  },

  async loadTodayStats() {
    this.setData({ loading: true });
    try {
      // 这里可以调用API获取真实统计数据
      const stats = {
        orders: Math.floor(Math.random() * 50) + 10,
        sales: (Math.random() * 10000 + 5000).toFixed(2),
        products: Math.floor(Math.random() * 200) + 100,
        revenue: (Math.random() * 15000 + 8000).toFixed(2)
      };

      this.setData({ todayStats: stats });
    } catch (error) {
      console.error('加载统计数据失败:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onModuleTap(e) {
    const { path } = e.currentTarget.dataset;
    if (path) {
      wx.navigateTo({
        url: path,
        fail: (err) => {
          console.error('页面跳转失败:', err);
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          });
        }
      });
    }
  },

  onStatsTap(e) {
    const { type } = e.currentTarget.dataset;
    let url = '';

    switch (type) {
      case 'orders':
        url = '/pages/admin/order/list/list';
        break;
      case 'products':
        url = '/pages/admin/product/list/list';
        break;
      default:
        return;
    }

    wx.navigateTo({ url });
  }
}) 