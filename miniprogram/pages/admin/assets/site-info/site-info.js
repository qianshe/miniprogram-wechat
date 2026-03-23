const { checkAdminAccess } = require('../../common/adminGuard.js')

Page({
  data: {
    phone: '',
    wechatId: '',
    loading: true,
    saving: false
  },

  onLoad() {
    if (!checkAdminAccess()) return;
    this.loadConfig();
  },

  async loadConfig() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('siteConfig').doc('contact').get();
      this.setData({
        phone: res.data.phone || '',
        wechatId: res.data.wechatId || '',
        loading: false
      });
    } catch (err) {
      console.error('加载联系方式失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onWechatInput(e) {
    this.setData({ wechatId: e.detail.value });
  },

  async onSave() {
    const { phone, wechatId, saving } = this.data;
    if (saving) return;

    if (!phone.trim()) {
      wx.showToast({ title: '请填写电话号码', icon: 'none' });
      return;
    }
    if (!wechatId.trim()) {
      wx.showToast({ title: '请填写微信号', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const db = wx.cloud.database();
      await db.collection('siteConfig').doc('contact').set({
        data: {
          phone: phone.trim(),
          wechatId: wechatId.trim(),
          updatedAt: Date.now()
        }
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      console.error('保存失败:', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
