const { adminApi } = require('../../../../utils/api.js');
const { checkAdminAccess } = require('../../../../utils/adminGuard.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    orderNo: '',
    qrCodeUrl: '',
    orderInfo: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!checkAdminAccess()) return
    if (options.orderNo && options.qrCodeUrl) {
      this.setData({
        orderNo: options.orderNo, // 订单号
        qrCodeUrl: decodeURIComponent(options.qrCodeUrl)
      });

      // 获取订单详情
      this.loadOrderDetail(options.orderNo);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail(orderNo) {
    wx.showLoading({
      title: '加载中...'
    });

    try {
      // 调用统一API获取订单详情
      const data = await adminApi.getOrderDetail(orderNo);

      wx.hideLoading();

      this.setData({
        orderInfo: {
          ...data,
          totalAmount: data.totalAmount.toFixed(2) // 云函数已转换为元
        }
      });
    } catch (err) {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);
      wx.showToast({
        title: err.message || err.result?.message || '获取订单详情失败',
        icon: 'none'
      });
    }
  },

  /**
   * 保存二维码到相册
   */
  saveQrCode() {
    if (!this.data.qrCodeUrl) {
      wx.showToast({
        title: '二维码不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '保存中...'
    });
    
    // 保存图片
    wx.downloadFile({
      url: this.data.qrCodeUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
              console.error('保存图片失败:', err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
        console.error('下载二维码失败:', err);
      }
    });
  },

  /**
   * 分享订单
   */
  shareOrder() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 返回列表
   */
  backToList() {
    wx.redirectTo({
      url: '/pages/admin/order/list/list'
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: `订单号:${this.data.orderNo}`,
      path: `/pages/scan-result/scan-result?orderNo=${this.data.orderNo}`,
      imageUrl: this.data.qrCodeUrl
    };
  },


}); 