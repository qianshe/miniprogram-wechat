// pages/feedback/feedback.js

Page({
  data: {
    qrcodeUrl: '',
    loading: true,
    loadError: false
  },

  onLoad() {
    this.loadQrcode();
  },

  async loadQrcode() {
    try {
      // 云存储文件ID - 环境ID: cloud1-5gudbe4m8263c9dc
      const fileID = 'cloud://cloud1-5gudbe4m8263c9dc.636c-cloud1-5gudbe4m8263c9dc-1379027289/assets/qrcode/wechat-group.png';
      
      const res = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      });
      
      if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
        this.setData({
          qrcodeUrl: res.fileList[0].tempFileURL,
          loading: false
        });
      } else {
        this.setData({ loading: false, loadError: true });
      }
    } catch (err) {
      console.error('加载二维码失败:', err);
      this.setData({ loading: false, loadError: true });
    }
  },

  onPullDownRefresh() {
    this.loadQrcode();
    wx.stopPullDownRefresh();
  }
});
