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
      region: [],
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
        province: '',
        city: '',
        district: '',
        detail: '',
        isDefault: false,
        region: [],
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
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail,
        isDefault: address.isDefault,
        region: [address.province, address.city, address.district],
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

  onRegionChange(e) {
    const region = e.detail.value;
    this.setData({
      'formData.province': region[0],
      'formData.city': region[1],
      'formData.district': region[2],
      'formData.region': region
    });
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
            console.warn('逆地理编码失败，回退手动地区选择:', error);
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

        wx.showToast({ title: '地图选点失败，可手动填写地址', icon: 'none' });
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
        console.warn('逆地理编码失败，回退手动地区选择:', error);
      }
    }

    const normalizedAddress = normalizeAddressFromLocation({
      mapSelection: safeMapSelection,
      geocodeResult: resolvedGeocodeResult,
      currentAddress
    });

    const nextFormData = {
      'formData.detail': normalizedAddress.detail,
      'formData.locationName': normalizedAddress.locationName,
      'formData.locationAddress': normalizedAddress.locationAddress,
      'formData.latitude': normalizedAddress.latitude,
      'formData.longitude': normalizedAddress.longitude
    };

    if (normalizedAddress.hasStructuredRegion) {
      nextFormData['formData.province'] = normalizedAddress.province;
      nextFormData['formData.city'] = normalizedAddress.city;
      nextFormData['formData.district'] = normalizedAddress.district;
      nextFormData['formData.region'] = normalizedAddress.region;
    }

    this.setData(nextFormData);

    wx.showToast({
      title: normalizedAddress.hasStructuredRegion
        ? '已自动补全所在地区'
        : (normalizedAddress.locationName ? '已选地图位置，请手动选择所在地区' : '已获取坐标，请手动选择所在地区'),
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
      content: '地图选点需要位置权限。你也可以跳过地图选点，继续手动填写地址。',
      confirmText: '去设置',
      cancelText: '手动填写',
      success: (res) => {
        if (!res.confirm) {
          wx.showToast({ title: '可继续手动填写地址', icon: 'none' });
          return;
        }

        wx.openSetting({
          success: (settingRes) => {
            const authSetting = (settingRes && settingRes.authSetting) || {};
            const hasLocationPermission = !!authSetting['scope.userLocation'];
            wx.showToast({
              title: hasLocationPermission ? '权限已开启，请重新选点' : '未开启权限，可手动填写地址',
              icon: 'none'
            });
          },
          fail: () => {
            wx.showToast({ title: '打开设置失败，请手动填写地址', icon: 'none' });
          }
        });
      }
    });
  },

  async saveAddress() {
    const { formData, editIndex, addressList, isLoggedIn } = this.data;

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
      province: formData.province,
      city: formData.city,
      district: formData.district,
      detail: formData.detail.trim(),
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
      province: formData.province,
      city: formData.city,
      district: formData.district,
      detail: formData.detail.trim(),
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