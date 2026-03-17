const { api } = require('../../utils/api.js');
const auth = require('../../utils/auth.js');

const PENDING_SCAN_KEY = 'pendingScanOrderNo';

Page({
  data: {
    orderNo: '',
    orderInfo: null,
    loading: true,
    errorMessage: '',
    isLoggedIn: false
  },

  onLoad(options) {
    let orderNo = '';

    if (options.orderNo) {
      orderNo = options.orderNo;
    } else if (options.q) {
      try {
        const url = decodeURIComponent(options.q);
        const match = url.match(/orderNo=([A-Za-z0-9_-]+)/);
        if (match && match[1]) {
          orderNo = match[1];
        }
      } catch (e) {
        console.error('解析二维码参数失败:', e);
      }
    }

    if (!orderNo) {
      this.setData({ loading: false, errorMessage: '无效的服务记录二维码' });
      return;
    }

    this.setData({ orderNo });
    this._checkLoginAndLoad(orderNo);
  },

  onShow() {
    // 从用户中心登录回来后，重新检查登录状态
    const { orderNo } = this.data;
    if (orderNo && !this.data.isLoggedIn) {
      const isLoggedIn = auth.checkAuth();
      if (isLoggedIn) {
        this.setData({ isLoggedIn });
        this.loadOrderPreview(orderNo);
      }
    }
  },

  _checkLoginAndLoad(orderNo) {
    const isLoggedIn = auth.checkAuth();
    this.setData({ isLoggedIn });
    this.loadOrderPreview(orderNo);
  },

  /**
   * 使用 getOrderPreview 加载订单预览（认领前无需登录）
   */
  loadOrderPreview(orderNo) {
    this.setData({ loading: true, errorMessage: '' });

    api.getOrderPreview(orderNo)
      .then(data => {
        // 如果已登录且订单已被绑定，直接跳到确认页
        if (this.data.isLoggedIn && data.isBound) {
          wx.redirectTo({
            url: `/pages/order/user-confirm/user-confirm?orderNo=${orderNo}`
          });
          return;
        }

        this.setData({
          orderInfo: {
            ...data,
            totalAmount: Number(data.totalAmount).toFixed(2),
            items: (data.items || []).map(item => ({
              ...item,
              price: Number(item.price).toFixed(2),
              subtotal: Number(item.subtotal).toFixed(2)
            }))
          },
          loading: false
        });
      })
      .catch(err => {
        console.error('获取服务记录信息失败:', err);
        this.setData({
          loading: false,
          errorMessage: err.message || '获取服务记录信息失败'
        });
      });
  },

  /**
   * 登录 - 存储 pending orderNo，跳转用户中心
   */
  login() {
    wx.setStorageSync(PENDING_SCAN_KEY, this.data.orderNo);
    wx.switchTab({ url: '/pages/user/user' });
  },

  /**
   * 认领服务记录
   */
  bindOrder() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在认领...' });

    const userInfo = auth.getUserInfo();
    const userId = userInfo ? (userInfo.id || userInfo._id || '') : '';

    api.bindOrder(this.data.orderNo, userId)
      .then(() => {
        wx.hideLoading();
        // 认领成功 → 跳转到确认信息页
        wx.redirectTo({
          url: `/pages/order/user-confirm/user-confirm?orderNo=${this.data.orderNo}`
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '认领失败', icon: 'none' });
      });
  },

  /**
   * 重试
   */
  retry() {
    if (this.data.orderNo) {
      this.loadOrderPreview(this.data.orderNo);
    }
  }
});
