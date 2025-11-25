// pages/address/address.js
const STORAGE_KEY = 'addressList';

Page({
  data: {
    addressList: [],
    showModal: false,
    editIndex: -1,
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false,
      region: []
    }
  },

  onLoad() {
    this.loadAddressList();
  },

  onShow() {
    this.loadAddressList();
  },

  // 加载地址列表
  loadAddressList() {
    const addressList = wx.getStorageSync(STORAGE_KEY) || [];
    this.setData({ addressList });
  },

  // 保存地址列表到本地存储
  saveAddressList(addressList) {
    wx.setStorageSync(STORAGE_KEY, addressList);
    this.setData({ addressList });
  },

  // 显示新增弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      editIndex: -1,
      formData: {
        name: '',
        phone: '',
        province: '',
        city: '',
        district: '',
        detail: '',
        isDefault: false,
        region: []
      }
    });
  },

  // 编辑地址
  editAddress(e) {
    const index = e.currentTarget.dataset.index;
    const address = this.data.addressList[index];
    this.setData({
      showModal: true,
      editIndex: index,
      formData: {
        name: address.name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail,
        isDefault: address.isDefault,
        region: [address.province, address.city, address.district]
      }
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({ showModal: false });
  },

  // 输入收货人
  onInputName(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  // 输入手机号
  onInputPhone(e) {
    this.setData({ 'formData.phone': e.detail.value });
  },

  // 选择地区
  onRegionChange(e) {
    const region = e.detail.value;
    this.setData({
      'formData.province': region[0],
      'formData.city': region[1],
      'formData.district': region[2],
      'formData.region': region
    });
  },

  // 输入详细地址
  onInputDetail(e) {
    this.setData({ 'formData.detail': e.detail.value });
  },

  // 切换默认地址
  onSwitchDefault(e) {
    this.setData({ 'formData.isDefault': e.detail.value });
  },

  // 保存地址
  saveAddress() {
    const { formData, editIndex, addressList } = this.data;

    // 表单验证
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    if (!formData.phone.trim() || !/^1\d{10}$/.test(formData.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!formData.province) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!formData.detail.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }

    const newAddress = {
      id: editIndex >= 0 ? addressList[editIndex].id : Date.now(),
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      province: formData.province,
      city: formData.city,
      district: formData.district,
      detail: formData.detail.trim(),
      isDefault: formData.isDefault
    };

    let newList = [...addressList];

    // 如果设置为默认，取消其他地址的默认状态
    if (formData.isDefault) {
      newList = newList.map(item => ({ ...item, isDefault: false }));
    }

    if (editIndex >= 0) {
      // 编辑模式
      newList[editIndex] = newAddress;
    } else {
      // 新增模式
      newList.push(newAddress);
    }

    // 如果是第一个地址，自动设为默认
    if (newList.length === 1) {
      newList[0].isDefault = true;
    }

    this.saveAddressList(newList);
    this.hideModal();
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // 设置默认地址
  setDefault(e) {
    const index = e.currentTarget.dataset.index;
    let newList = this.data.addressList.map((item, i) => ({
      ...item,
      isDefault: i === index
    }));
    this.saveAddressList(newList);
    wx.showToast({ title: '已设为默认', icon: 'success' });
  },

  // 删除地址
  deleteAddress(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个收货地址吗？',
      success: (res) => {
        if (res.confirm) {
          let newList = [...this.data.addressList];
          const wasDefault = newList[index].isDefault;
          newList.splice(index, 1);
          
          // 如果删除的是默认地址且还有其他地址，将第一个设为默认
          if (wasDefault && newList.length > 0) {
            newList[0].isDefault = true;
          }
          
          this.saveAddressList(newList);
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  }
});