const packageApi = require('../../../../api/package.js');
const { normalizePrice } = require('../../../../utils/util.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');

Page({
  data: {
    packageList: [],
    packageLoading: false
  },

  onLoad() {
    if (!checkAdminAccess()) return;
    this.loadPackages();
  },

  async loadPackages() {
    this.setData({ packageLoading: true });

    try {
      const app = getApp();
      const type = app.globalData.systemType || 'white';
      const result = await packageApi.adminGetList({
        page: 1,
        size: 50,
        type,
        status: 1
      }, { showLoading: false });

      const records = result?.records || result?.list || [];
      const packageList = records.map(pkg => ({
        ...pkg,
        id: pkg._id || pkg.id,
        name: pkg.name || '未命名套餐',
        description: pkg.description || '',
        price: normalizePrice(pkg.price) || 0
      }));

      this.setData({ packageList, packageLoading: false });
    } catch (err) {
      console.error('加载套餐失败:', err);
      this.setData({ packageList: [], packageLoading: false });
    }
  },

  startPackageCreate(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/admin/order/create/create?mode=package&packageId=${id}`
    });
  },

  startFreeCreate() {
    wx.navigateTo({
      url: '/pages/admin/order/create/create?mode=free'
    });
  }
});
