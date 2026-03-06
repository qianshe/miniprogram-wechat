const app = getApp()
const { adminApi } = require('../../../utils/api')
const { checkAdminAccess } = require('../common/adminGuard.js')
const { ORDER_FLOW_STATUS, PAYMENT_STATUS } = require('../../../config/constants')

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
      },
      {
        id: 'assets',
        name: '图片管理',
        icon: '🖼️',
        desc: '管理系统图片资源',
        path: '/pages/admin/assets/images/images'
      }
    ],
    // 今日数据统计
    todayStats: {
      orders: 0,
      sales: '0.00',
      users: 0,
      revenue: '0.00'
    },
    // 展示用主状态分布（单一主状态）
    mainStatus: {
      pendingPayment: 0, // 待付款（未开始服务）
      waitService: 0,    // 待服务
      processing: 0,     // 服务中
      serviceDone: 0,    // 待尾款（服务已完成）
      completed: 0,      // 已完成
      cancelled: 0       // 已取消
    },
    // 订单状态分布（旧字段，保持兼容）
    orderStatus: {
      pending: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      servedUnpaid: 0
    },
    // 新订单流程状态分布
    orderFlowStatus: {
      created: 0,      // 待服务
      processing: 0,   // 服务中
      serviceDone: 0,  // 服务完成
      completed: 0,    // 已完成
      cancelled: 0     // 已取消
    },
    // 支付状态分布
    paymentStatusDist: {
      unpaid: 0,  // 待付款
      paid: 0     // 已支付
    },
    loading: false
  },

  onLoad() {
    if (!checkAdminAccess()) return
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
      const [statsData, usersResult] = await Promise.all([
        adminApi.getStatistics(),
        this.getUserCount()
      ]);

      // callCloudFunction 已解包，statsData 直接是统计数据
      if (statsData) {
        // 尝试从 statsData 获取 mainStatus
        // 兼容两种可能的数据结构：
        // 1. 标准结构: statsData.mainStatus 存在
        // 2. 扁平结构: statsData 直接就是 mainStatus 对象
        let mainStatus = statsData.mainStatus;
        
        // 如果 mainStatus 不存在，检查 statsData 是否直接就是 mainStatus 对象
        if (!mainStatus && statsData.pendingPayment !== undefined) {
          mainStatus = statsData;
        }
        
        const { today, total, legacyStatus, orderFlowStatus, paymentStatusDist } = statsData;
        
        this.setData({
          todayStats: {
            orders: today?.orders || 0,
            sales: (today?.sales || 0).toFixed(2),
            users: usersResult || 0,
            // 总收入只计算已支付订单金额（云函数已处理）
            revenue: (total?.sales || 0).toFixed(2)
          },
          // 展示用主状态分布（单一主状态）
          mainStatus: {
            pendingPayment: mainStatus?.pendingPayment || 0,
            waitService: mainStatus?.waitService || 0,
            processing: mainStatus?.processing || 0,
            serviceDone: mainStatus?.serviceDone || 0,
            completed: mainStatus?.completed || 0,
            cancelled: mainStatus?.cancelled || 0
          },
          // 旧订单状态分布（兼容）
          orderStatus: {
            pending: legacyStatus?.pending || 0,
            paid: legacyStatus?.paid || 0,
            processing: legacyStatus?.processing || 0,
            completed: legacyStatus?.completed || 0,
            servedUnpaid: legacyStatus?.servedUnpaid || 0
          },
          // 新订单流程状态分布
          orderFlowStatus: {
            created: orderFlowStatus?.created || 0,
            processing: orderFlowStatus?.processing || 0,
            serviceDone: orderFlowStatus?.serviceDone || 0,
            completed: orderFlowStatus?.completed || 0,
            cancelled: orderFlowStatus?.cancelled || 0
          },
          // 支付状态分布
          paymentStatusDist: {
            unpaid: paymentStatusDist?.unpaid || 0,
            paid: paymentStatusDist?.paid || 0
          },
          fullStatistics: statsData
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async getUserCount() {
    try {
      return await adminApi.getUserCount()
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
    const { status, filterType, filterValue, orderStatus, paymentStatus } = e.currentTarget.dataset;
    let url = '/pages/admin/order/list/list';

    const params = [];
    if (orderStatus !== undefined) {
      params.push(`orderStatus=${orderStatus}`);
    }
    if (paymentStatus !== undefined) {
      params.push(`paymentStatus=${paymentStatus}`);
    }
    if (params.length) {
      url += `?${params.join('&')}`;
      wx.navigateTo({ url });
      return;
    }
    
    // 支持新的双字段筛选参数
    if (filterType === 'paymentStatus') {
      url += `?paymentStatus=${filterValue}`;
    } else if (filterType === 'orderStatus') {
      url += `?orderStatus=${filterValue}`;
    } else if (status !== undefined) {
      // 兼容旧的 status 参数
      url += `?status=${status}`;
    }
    
    wx.navigateTo({ url });
  }
})
