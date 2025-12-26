const app = getApp()
const { adminApi } = require('../../../utils/api')
const { user: userApi } = require('../../../api/index')

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
        id: 'category',
        name: '分类管理',
        icon: '📋',
        desc: '管理商品分类',
        path: '/pages/admin/category/list/list'
      },
      {
        id: 'package',
        name: '套餐管理',
        icon: '🎁',
        desc: '管理套餐信息',
        path: '/pages/admin/package/list/list'
      },
      {
        id: 'user',
        name: '用户管理',
        icon: '👥',
        desc: '管理用户和权限',
        path: '/pages/admin/user/list/list'
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
      sales: '0.00',
      users: 0,
      revenue: '0.00'
    },
    // 订单状态分布
    orderStatus: {
      pending: 0,
      paid: 0,
      processing: 0,
      completed: 0
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
      // 并行调用统计API和用户统计
      const [statsResult, usersResult] = await Promise.all([
        adminApi.getStatistics(),
        this.getUserCount()
      ]);

      if (statsResult.code === 0 && statsResult.data) {
        const { today, total, orderStatus } = statsResult.data;
        this.setData({
          todayStats: {
            orders: today.orders || 0,
            sales: (today.sales || 0).toFixed(2),
            users: usersResult || 0,
            revenue: (total.sales || 0).toFixed(2)
          },
          orderStatus: {
            pending: orderStatus?.pending || 0,
            paid: orderStatus?.paid || 0,
            processing: orderStatus?.processing || 0,
            completed: orderStatus?.completed || 0
          },
          fullStatistics: statsResult.data
        });
      } else {
        console.error('获取统计数据失败:', statsResult.message);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async getUserCount() {
    try {
      return await userApi.adminGetUserCount()
    } catch (err) {
      console.error('获取用户数失败:', err);
      return 0;
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
      case 'users':
        url = '/pages/admin/user/list/list';
        break;
      default:
        return;
    }

    wx.navigateTo({ url });
  },

  onStatusTap(e) {
    const { status } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/admin/order/list/list?status=${status}`
    });
  }
})