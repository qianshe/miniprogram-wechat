/**
 * 用户确认服务信息页面
 * 
 * 这是用户认领订单后的明确确认步骤（confirmation milestone）：
 * - 用户在此页面确认并补充服务信息（联系人、电话、地址、服务时间等）
 * - 提交后，后端记录 contentConfirmedAt，订单进入"已确认待服务"里程碑
 * - 一旦确认，此页面变为只读，用户无法再次修改
 * 
 * 里程碑流转：claimed-unconfirmed → confirmed-ready-for-service
 * 
 * @see config/constants.js - WORKFLOW_MILESTONE, isPastConfirmationMilestone
 */
const { api } = require('../../../utils/api.js');
const { loadSelectableAddresses } = require('../../../utils/addressSelection.js');
const { buildThumbUrl } = require('../../../utils/imageThumb.js');
const {
  WORKFLOW_MILESTONE,
  getWorkflowMilestone,
  isPastConfirmationMilestone
} = require('../../../config/constants.js');

Page({
  data: {
    loading: true,
    submitting: false,
    orderNo: '',
    orderInfo: null,
    // 可编辑字段
    contactName: '',
    contactPhone: '',
    serviceTime: '',
    remarks: '',
    // 地址
    address: null,
    addressText: '',
    showAddressModal: false,
    addressList: [],
    // 是否只读（非 CREATED 状态）
    isReadOnly: false,
    isContentConfirmed: false
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
      
      // 使用里程碑语义判断：已过确认里程碑则为只读
      const milestone = getWorkflowMilestone(data);
      const isContentConfirmed = isPastConfirmationMilestone(data);
      const isReadOnly = isContentConfirmed || milestone === WORKFLOW_MILESTONE.CANCELLED;
      
      const normalizedAddress = data.address && typeof data.address === 'object' ? data.address : null;

      this.setData({
        orderInfo: {
          ...data,
          totalAmount: Number(data.totalAmount).toFixed(2),
          items: (data.items || []).map(item => ({
            ...item,
            price: Number(item.price).toFixed(2),
            subtotal: Number(item.subtotal).toFixed(2),
            thumbUrl: buildThumbUrl(item.productImage || item.thumb || item.coverImage, { size: 160 }) || ''
          }))
        },
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        serviceTime: data.serviceTime || '',
        remarks: data.remarks || '',
        address: normalizedAddress,
        addressText: this._formatAddress(data.address),
        isReadOnly,
        isContentConfirmed,
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
    if (typeof address === 'string') return address.trim();
    return [address.provinceName, address.cityName, address.countyName, address.detailInfo]
      .filter(Boolean).join(' ');
  },

  onNameInput(e) {
    this.setData({ contactName: e.detail.value });
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
    const importedName = address.userName || address.name || '';
    const importedPhone = address.telNumber || address.phone || '';

    this.setData({
      address,
      addressText: this._formatAddress(address),
      contactName: importedName,
      contactPhone: importedPhone,
      showAddressModal: false
    });
  },

  async onSubmit() {
    if (this.data.submitting || this.data.isReadOnly) return;

    const { orderNo, contactName, contactPhone, serviceTime, address, remarks } = this.data;

    if (!contactName || !contactName.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }

    if (!contactPhone || !contactPhone.trim()) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }

    if (!serviceTime || !serviceTime.trim()) {
      wx.showToast({ title: '请选择服务时间', icon: 'none' });
      return;
    }

    if (!address || typeof address !== 'object') {
      wx.showToast({ title: '请选择服务地址', icon: 'none' });
      return;
    }

    const confirmResult = await new Promise(resolve => {
      wx.showModal({
        title: '确认提交',
        content: '提交后将进入待服务状态，服务信息将不可再修改。',
        confirmText: '确认提交',
        cancelText: '再检查一下',
        success: res => resolve(res.confirm)
      });
    });

    if (!confirmResult) {
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.updateOrderUserInfo(orderNo, {
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        serviceTime: serviceTime.trim(),
        address: address || undefined,
        remarks: remarks.trim()
      });

      wx.showToast({ title: '确认成功，等待服务安排', icon: 'success' });
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
