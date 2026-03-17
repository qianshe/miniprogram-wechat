/**
 * 用户确认信息页面
 * 用户认领订单后，查看并补充/修改服务信息
 */
const { api } = require('../../../utils/api.js');
const { loadSelectableAddresses } = require('../../../utils/addressSelection.js');

const ORDER_FLOW_STATUS_CREATED = 0;

Page({
  data: {
    loading: true,
    submitting: false,
    orderNo: '',
    orderInfo: null,
    // 可编辑字段
    contactPhone: '',
    serviceTime: '',
    remarks: '',
    // 地址
    address: null,
    addressText: '',
    showAddressModal: false,
    addressList: [],
    // 是否只读（非 CREATED 状态）
    isReadOnly: false
  },

  onLoad(options) {
    if (!options.orderNo) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.setData({ orderNo: options.orderNo });
    this.loadOrderDetail(options.orderNo);
  },

  async loadOrderDetail(orderNo) {
    this.setData({ loading: true });
    try {
      const data = await api.getOrderDetail(orderNo, false);
      const isReadOnly = data.orderStatus !== ORDER_FLOW_STATUS_CREATED;

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
        contactPhone: data.contactPhone || '',
        serviceTime: data.serviceTime || '',
        remarks: data.remarks || '',
        address: data.address || null,
        addressText: this._formatAddress(data.address),
        isReadOnly,
        loading: false
      });
    } catch (err) {
      console.error('加载订单详情失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  _formatAddress(address) {
    if (!address) return '';
    return [address.provinceName, address.cityName, address.countyName, address.detailInfo]
      .filter(Boolean).join(' ');
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value });
  },

  onServiceTimeInput(e) {
    this.setData({ serviceTime: e.detail.value });
  },

  onRemarksInput(e) {
    this.setData({ remarks: e.detail.value });
  },

  async onSelectAddress() {
    if (this.data.isReadOnly) return;
    try {
      const addressList = await loadSelectableAddresses();
      this.setData({ addressList, showAddressModal: true });
    } catch (err) {
      console.error('加载地址列表失败:', err);
      wx.showToast({ title: '加载地址失败', icon: 'none' });
    }
  },

  onAddressModalClose() {
    this.setData({ showAddressModal: false });
  },

  onAddressPick(e) {
    const address = e.currentTarget.dataset.address;
    this.setData({
      address,
      addressText: this._formatAddress(address),
      showAddressModal: false
    });
  },

  async onSubmit() {
    if (this.data.submitting || this.data.isReadOnly) return;

    const { orderNo, contactPhone, serviceTime, address, remarks } = this.data;

    if (!serviceTime || !serviceTime.trim()) {
      wx.showToast({ title: '请填写服务时间', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.updateOrderUserInfo(orderNo, {
        contactPhone: contactPhone.trim(),
        serviceTime: serviceTime.trim(),
        address: address || undefined,
        remarks: remarks.trim()
      });

      wx.showToast({ title: '确认成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/order/detail/detail?orderNo=${orderNo}` });
      }, 1000);
    } catch (err) {
      console.error('提交确认信息失败:', err);
      wx.showToast({ title: err.message || '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onViewDetail() {
    wx.redirectTo({ url: `/pages/order/detail/detail?orderNo=${this.data.orderNo}` });
  }
});