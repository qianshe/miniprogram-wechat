const app = getApp()
const { adminApi } = require('../../../utils/api')
const { checkAdminAccess } = require('../common/adminGuard.js')
const { ORDER_FLOW_STATUS, PAYMENT_STATUS, WORKFLOW_MILESTONE, getAdminWorkflowSummary } = require('../../../config/constants')

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
        icon: '🗂️',
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
        id: 'process',
        name: '流程管理',
        icon: '序',
        desc: '浏览治丧流程步骤',
        path: '/pages/admin/process/list/list'
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
        path: '/pages/admin/order/create-entry/create-entry'
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
      },
      {
        id: 'site-info',
        name: '联系方式',
        icon: '📞',
        desc: '配置客服电话和微信号',
        path: '/pages/admin/assets/site-info/site-info'
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
      pendingPayment: 0, // 待沟通/待确认
      waitService: 0,    // 已确认待服务
      processing: 0,     // 服务中
      serviceDone: 0,    // 待尾款（服务已完成）
      completed: 0,      // 已完成
      cancelled: 0       // 已取消
    },
    workflowMilestoneFilters: {
      pendingPayment: `${WORKFLOW_MILESTONE.UNCLAIMED},${WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED}`,
      claimedUnconfirmed: WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED,
      confirmedReady: WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE,
      processing: WORKFLOW_MILESTONE.PROCESSING,
      serviceDone: WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID,
      completed: WORKFLOW_MILESTONE.COMPLETED,
      cancelled: WORKFLOW_MILESTONE.CANCELLED
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
        const workflowMilestoneDist = statsData.workflowMilestoneDist || statsData.workflowMilestoneStatus || {};
        const hasMilestoneStats = workflowMilestoneDist && Object.keys(workflowMilestoneDist).length > 0;
        const mainStatusFromMilestones = hasMilestoneStats
          ? this.buildMainStatusFromMilestones(workflowMilestoneDist)
          : null;
        const resolvedMainStatus = mainStatusFromMilestones || mainStatus || {};

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
            pendingPayment: resolvedMainStatus.pendingPayment || 0,
            waitService: resolvedMainStatus.waitService || 0,
            processing: resolvedMainStatus.processing || 0,
            serviceDone: resolvedMainStatus.serviceDone || 0,
            completed: resolvedMainStatus.completed || 0,
            cancelled: resolvedMainStatus.cancelled || 0
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
    const {
      status,
      filterType,
      filterValue,
      orderStatus,
      paymentStatus,
      workflowMilestones,
      workflowMilestone
    } = e.currentTarget.dataset;
    let url = '/pages/admin/order/list/list';

    if (workflowMilestones) {
      url += `?workflowMilestone=${encodeURIComponent(workflowMilestones)}`;
      wx.navigateTo({ url });
      return;
    }

    if (workflowMilestone) {
      url += `?workflowMilestone=${encodeURIComponent(workflowMilestone)}`;
      wx.navigateTo({ url });
      return;
    }

    // 首页主状态卡片参数：与 ADMIN_ORDER_TABS 的 orderStatus/paymentStatus 对齐
    const params = [];
    const hasOrderStatus = orderStatus !== undefined && orderStatus !== null && orderStatus !== '';
    const hasPaymentStatus = paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== '';

    if (hasOrderStatus) {
      params.push(`orderStatus=${orderStatus}`);
    }
    if (hasPaymentStatus) {
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
  },

  buildMainStatusFromMilestones(workflowMilestoneDist = {}) {
    const milestones = workflowMilestoneDist && typeof workflowMilestoneDist === 'object'
      ? workflowMilestoneDist
      : {};

    if (!Object.keys(milestones).length) {
      return null;
    }

    const bucketCounts = {
      pendingPayment: 0,
      waitService: 0,
      processing: 0,
      serviceDone: 0,
      completed: 0,
      cancelled: 0
    };

    const sampleOrders = {
      [WORKFLOW_MILESTONE.UNCLAIMED]: {
        orderStatus: ORDER_FLOW_STATUS.CREATED,
        waitForBind: true,
        paymentStatus: PAYMENT_STATUS.UNPAID
      },
      [WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED]: {
        orderStatus: ORDER_FLOW_STATUS.CREATED,
        paymentStatus: PAYMENT_STATUS.UNPAID
      },
      [WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE]: {
        orderStatus: ORDER_FLOW_STATUS.CREATED,
        contentConfirmedAt: '1',
        paymentStatus: PAYMENT_STATUS.UNPAID
      },
      [WORKFLOW_MILESTONE.PROCESSING]: {
        orderStatus: ORDER_FLOW_STATUS.PROCESSING,
        paymentStatus: PAYMENT_STATUS.UNPAID
      },
      [WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID]: {
        orderStatus: ORDER_FLOW_STATUS.SERVICE_DONE,
        paymentStatus: PAYMENT_STATUS.UNPAID
      },
      [WORKFLOW_MILESTONE.COMPLETED]: {
        orderStatus: ORDER_FLOW_STATUS.COMPLETED,
        paymentStatus: PAYMENT_STATUS.PAID
      },
      [WORKFLOW_MILESTONE.CANCELLED]: {
        orderStatus: ORDER_FLOW_STATUS.CANCELLED,
        paymentStatus: PAYMENT_STATUS.UNPAID
      }
    };

    Object.keys(milestones).forEach((milestone) => {
      const count = milestones[milestone] || 0;
      if (!count) return;

      const sample = sampleOrders[milestone];
      if (!sample) return;

      const bucket = getAdminWorkflowSummary(sample).adminMainStatusBucket;
      if (bucketCounts[bucket] !== undefined) {
        bucketCounts[bucket] += count;
      }
    });

    return bucketCounts;
  }
})
