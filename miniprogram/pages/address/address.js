// pages/address/address.js
const addressApi = require('../../api/address.js');
const auth = require('../../utils/auth.js');
const { normalizeAddressFromLocation } = require('../../utils/addressSelection.js');

const STORAGE_KEY = 'addressList';

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveDetailFeatureText(formData = {}) {
  const detail = (formData.detail || '').trim();
  if (detail) {
    return detail;
  }

  const locationName = (formData.locationName || '').trim();
  if (locationName) {
    return locationName;
  }

  return (formData.locationAddress || '').trim();
}

Page({
  data: {
    addressList: [],
    showModal: false,
    editIndex: -1,
    formData: {
      name: '',
      phone: '',
      detail: '',
      isDefault: false,
      locationName: '',
      locationAddress: '',
      latitude: null,
      longitude: null
    },
    loading: false,
    isLoggedIn: false
  },

  onLoad() {
    this.checkLoginAndLoad();
  },

  onShow() {
    this.checkLoginAndLoad();
  },

  checkLoginAndLoad() {
    const isLoggedIn = auth.checkAuth();
    this.setData({ isLoggedIn });

    if (isLoggedIn) {
      this.loadAddressListFromCloud();
    } else {
      this.loadAddressListFromLocal();
    }
  },

  async loadAddressListFromCloud() {
    this.setData({ loading: true });
    try {
      const result = await addressApi.getList();
      const addressList = result || [];
      this.setData({ addressList });
      wx.setStorageSync(STORAGE_KEY, addressList);
    } catch (error) {
      console.error('从云端加载地址失败:', error);
      this.loadAddressListFromLocal();
    } finally {
      this.setData({ loading: false });
    }
  },

  loadAddressListFromLocal() {
    const addressList = wx.getStorageSync(STORAGE_KEY) || [];
    this.setData({ addressList });
  },

  showAddModal() {
    this.setData({
      showModal: true,
      editIndex: -1,
      formData: {
        name: '',
        phone: '',
        detail: '',
        isDefault: false,
        locationName: '',
        locationAddress: '',
        latitude: null,
        longitude: null
      }
    });
  },

  editAddress(e) {
    const index = e.currentTarget.dataset.index;
    const address = this.data.addressList[index];
    this.setData({
      showModal: true,
      editIndex: index,
      formData: {
        _id: address._id,
        name: address.name,
        phone: address.phone,
        detail: address.detail,
        isDefault: address.isDefault,
        locationName: address.locationName || '',
        locationAddress: address.locationAddress || address.address || '',
        latitude: normalizeCoordinate(address.latitude),
        longitude: normalizeCoordinate(address.longitude)
      }
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onInputName(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  onInputPhone(e) {
    this.setData({ 'formData.phone': e.detail.value });
  },

  onInputDetail(e) {
    this.setData({ 'formData.detail': e.detail.value });
  },

  onSwitchDefault(e) {
    this.setData({ 'formData.isDefault': e.detail.value });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: async (res) => {
        const mapSelection = {
          locationName: (res.name || res.address || '').trim(),
          locationAddress: (res.address || '').trim(),
          latitude: normalizeCoordinate(res.latitude),
          longitude: normalizeCoordinate(res.longitude)
        };

        let geocodeResult = {};
        if (mapSelection.latitude !== null && mapSelection.longitude !== null) {
          try {
            geocodeResult = await addressApi.reverseGeocodeLocation({
              latitude: mapSelection.latitude,
              longitude: mapSelection.longitude,
              locationName: mapSelection.locationName,
              locationAddress: mapSelection.locationAddress
            }, {
              showLoading: false,
              showError: false
            });
          } catch (error) {
            console.warn('逆地理编码失败，保留地图原始结果:', error);
          }
        }

        await this.applyLocationSelection(mapSelection, geocodeResult);
      },
      fail: (err) => {
        const errMsg = (err && err.errMsg) || '';

        if (errMsg.includes('cancel')) {
          return;
        }

        if (this.isLocationAuthDenied(errMsg)) {
          this.handleLocationPermissionDenied();
          return;
        }

        wx.showToast({ title: '地图选点失败，请重试', icon: 'none' });
      }
    });
  },

  async applyLocationSelection(mapSelection = {}, geocodeResult = {}) {
    const currentAddress = this.data.formData || {};
    const safeMapSelection = {
      ...mapSelection,
      latitude: normalizeCoordinate(mapSelection.latitude),
      longitude: normalizeCoordinate(mapSelection.longitude)
    };

    let resolvedGeocodeResult = geocodeResult || {};
    const hasPrefetchedGeocode = resolvedGeocodeResult && Object.keys(resolvedGeocodeResult).length > 0;

    if (!hasPrefetchedGeocode && safeMapSelection.latitude !== null && safeMapSelection.longitude !== null) {
      try {
        resolvedGeocodeResult = await addressApi.reverseGeocodeLocation({
          latitude: safeMapSelection.latitude,
          longitude: safeMapSelection.longitude,
          locationName: safeMapSelection.locationName,
          locationAddress: safeMapSelection.locationAddress
        }, {
          showLoading: false,
          showError: false
        });
      } catch (error) {
        console.warn('逆地理编码失败，保留地图原始结果:', error);
      }
    }

    const normalizedAddress = normalizeAddressFromLocation({
      mapSelection: safeMapSelection,
      geocodeResult: resolvedGeocodeResult,
      currentAddress
    });

    const nextFormData = {
      'formData.detail': (this.data.formData.detail || '').trim() || normalizedAddress.locationName || normalizedAddress.locationAddress || normalizedAddress.detail,
      'formData.locationName': normalizedAddress.locationName,
      'formData.locationAddress': normalizedAddress.locationAddress,
      'formData.latitude': normalizedAddress.latitude,
      'formData.longitude': normalizedAddress.longitude
    };

    this.setData(nextFormData);

    wx.showToast({
      title: normalizedAddress.locationName ? '已选地图位置' : '已记录地图坐标',
      icon: 'none'
    });
  },

  isLocationAuthDenied(errMsg = '') {
    const lowered = String(errMsg).toLowerCase();
    return lowered.includes('auth deny') || lowered.includes('auth denied') || lowered.includes('authorize');
  },

  handleLocationPermissionDenied() {
    wx.showModal({
      title: '需要位置权限',
      content: '地图选点是必填项，需要位置权限后才能保存地址。',
      confirmText: '去设置',
      cancelText: '我知道了',
      success: (res) => {
        if (!res.confirm) {
          wx.showToast({ title: '请开启权限后重新选点', icon: 'none' });
          return;
        }

        wx.openSetting({
          success: (settingRes) => {
            const authSetting = (settingRes && settingRes.authSetting) || {};
            const hasLocationPermission = !!authSetting['scope.userLocation'];
            wx.showToast({
              title: hasLocationPermission ? '权限已开启，请重新选点' : '未开启权限，无法保存地址',
              icon: 'none'
            });
          },
          fail: () => {
            wx.showToast({ title: '打开设置失败，请稍后重试', icon: 'none' });
          }
        });
      }
    });
  },

  async saveAddress() {
    const { formData, editIndex, addressList, isLoggedIn } = this.data;
    const detailFeatureText = resolveDetailFeatureText(formData);

    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    if (!formData.phone.trim() || !/^1\d{10}$/.test(formData.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (normalizeCoordinate(formData.latitude) === null || normalizeCoordinate(formData.longitude) === null) {
      wx.showToast({ title: '请先在地图上选择位置', icon: 'none' });
      return;
    }
    if (!detailFeatureText) {
      wx.showToast({ title: '请输入地点特征', icon: 'none' });
      return;
    }

    if (detailFeatureText !== formData.detail) {
      this.setData({ 'formData.detail': detailFeatureText });
      formData.detail = detailFeatureText;
    }

    this.setData({ loading: true });

    try {
      if (isLoggedIn) {
        await this.saveAddressToCloud(formData, editIndex);
      } else {
        this.saveAddressToLocal(formData, editIndex, addressList);
      }
      this.hideModal();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存地址失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async saveAddressToCloud(formData, editIndex) {
    const addressData = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      detail: resolveDetailFeatureText(formData),
      isDefault: formData.isDefault,
      locationName: (formData.locationName || '').trim(),
      locationAddress: (formData.locationAddress || '').trim(),
      latitude: normalizeCoordinate(formData.latitude),
      longitude: normalizeCoordinate(formData.longitude)
    };

    if (editIndex >= 0 && formData._id) {
      await addressApi.update({ addressId: formData._id, ...addressData });
    } else {
      await addressApi.add(addressData);
    }
    await this.loadAddressListFromCloud();
  },

  saveAddressToLocal(formData, editIndex, addressList) {
    const newAddress = {
      id: editIndex >= 0 ? addressList[editIndex].id : Date.now(),
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      detail: resolveDetailFeatureText(formData),
      isDefault: formData.isDefault,
      locationName: (formData.locationName || '').trim(),
      locationAddress: (formData.locationAddress || '').trim(),
      latitude: normalizeCoordinate(formData.latitude),
      longitude: normalizeCoordinate(formData.longitude)
    };

    let newList = [...addressList];

    if (formData.isDefault) {
      newList = newList.map(item => ({ ...item, isDefault: false }));
    }

    if (editIndex >= 0) {
      newList[editIndex] = newAddress;
    } else {
      newList.push(newAddress);
    }

    if (newList.length === 1) {
      newList[0].isDefault = true;
    }

    wx.setStorageSync(STORAGE_KEY, newList);
    this.setData({ addressList: newList });
  },

  async setDefault(e) {
    const index = e.currentTarget.dataset.index;
    const address = this.data.addressList[index];

    if (this.data.isLoggedIn && address._id) {
      try {
        await addressApi.setDefault(address._id);
        await this.loadAddressListFromCloud();
        wx.showToast({ title: '已设为默认', icon: 'success' });
      } catch (error) {
        console.error('设置默认地址失败:', error);
        wx.showToast({ title: '设置失败', icon: 'none' });
      }
    } else {
      const newList = this.data.addressList.map((item, i) => ({
        ...item,
        isDefault: i === index
      }));
      wx.setStorageSync(STORAGE_KEY, newList);
      this.setData({ addressList: newList });
      wx.showToast({ title: '已设为默认', icon: 'success' });
    }
  },

  deleteAddress(e) {
    const index = e.currentTarget.dataset.index;
    const address = this.data.addressList[index];

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个收货地址吗？',
      success: async (res) => {
        if (res.confirm) {
          if (this.data.isLoggedIn && address._id) {
            try {
              await addressApi.remove({ addressId: address._id });
              await this.loadAddressListFromCloud();
              wx.showToast({ title: '删除成功', icon: 'success' });
            } catch (error) {
              console.error('删除地址失败:', error);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } else {
            const newList = [...this.data.addressList];
            const wasDefault = newList[index].isDefault;
            newList.splice(index, 1);

            if (wasDefault && newList.length > 0) {
              newList[0].isDefault = true;
            }

            wx.setStorageSync(STORAGE_KEY, newList);
            this.setData({ addressList: newList });
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        }
      }
    });
  }
});