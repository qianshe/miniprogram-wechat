/**
 * 地址选择统一 Helper
 * 解决确认订单页地址加载不一致问题：云端优先 + 本地兜底
 */

const auth = require('./auth.js');
const addressApi = require('../api/address.js');

const ADDRESS_STORAGE_KEY = 'addressList';

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstText(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

/**
 * 地图选点 + 逆地理编码统一归一化
 */
function normalizeAddressFromLocation({ mapSelection = {}, geocodeResult = {}, currentAddress = {} } = {}) {
  const latitude = normalizeCoordinate(
    mapSelection.latitude !== undefined ? mapSelection.latitude
      : geocodeResult.latitude !== undefined ? geocodeResult.latitude
        : currentAddress.latitude
  );
  const longitude = normalizeCoordinate(
    mapSelection.longitude !== undefined ? mapSelection.longitude
      : geocodeResult.longitude !== undefined ? geocodeResult.longitude
        : currentAddress.longitude
  );
  const locationName = pickFirstText(
    mapSelection.locationName,
    mapSelection.name,
    geocodeResult.locationName,
    currentAddress.locationName
  );
  const locationAddress = pickFirstText(
    mapSelection.locationAddress,
    mapSelection.address,
    geocodeResult.locationAddress,
    currentAddress.locationAddress
  );

  const province = pickFirstText(geocodeResult.province, currentAddress.province);
  const city = pickFirstText(geocodeResult.city, currentAddress.city);
  const district = pickFirstText(geocodeResult.district, currentAddress.district);
  const hasStructuredRegion = Boolean(province && city && district);
  const region = hasStructuredRegion
    ? [province, city, district]
    : (Array.isArray(currentAddress.region) ? currentAddress.region : []);
  const detail = pickFirstText(currentAddress.detail, geocodeResult.detail, locationAddress);

  return {
    province,
    city,
    district,
    detail,
    region,
    locationName,
    locationAddress,
    latitude,
    longitude,
    hasStructuredRegion
  };
}

/**
 * 归一化地址格式：地址管理格式 → 订单确认格式
 */
function normalizeAddressForOrder(addr) {
  if (!addr) return null;

  const provinceName = addr.provinceName || addr.province || '';
  const cityName = addr.cityName || addr.city || '';
  const countyName = addr.countyName || addr.district || '';
  const detailInfo = addr.detailInfo || addr.detail || '';
  const structuredFullAddress = `${provinceName}${cityName}${countyName}${detailInfo}`.trim();
  const mapAddress = (addr.locationAddress || addr.address || '').trim();
  const fallbackFullAddress = mapAddress || (addr.fullAddress || '').trim() || (addr.locationName || '').trim();
  
  return {
    id: addr.id || addr._id,
    userName: addr.userName || addr.name || '',
    telNumber: addr.telNumber || addr.phone || '',
    provinceName,
    cityName,
    countyName,
    detailInfo,
    fullAddress: structuredFullAddress || fallbackFullAddress,
    isDefault: addr.isDefault || false,
    // T10 定位字段透传
    latitude: normalizeCoordinate(addr.latitude),
    longitude: normalizeCoordinate(addr.longitude),
    locationName: (addr.locationName || '').trim(),
    locationAddress: addr.locationAddress || addr.address || ''
  };
}

/**
 * 从列表中挑选默认地址
 */
function pickDefaultAddress(list) {
  if (!list || list.length === 0) return null;
  return list.find(a => a.isDefault) || list[0];
}

/**
 * 加载可选地址列表（云端优先 + 本地兜底）
 */
async function loadSelectableAddresses() {
  // 云端优先（登录态）
  const isLoggedIn = auth.checkAuth ? auth.checkAuth() : false;
  
  if (isLoggedIn) {
    try {
      const cloudList = await addressApi.getList({ showLoading: false });
      if (cloudList && cloudList.length > 0) {
        // 同步回本地缓存供离线使用
        wx.setStorageSync(ADDRESS_STORAGE_KEY, cloudList);
        return cloudList.map(normalizeAddressForOrder);
      }
    } catch (e) {
      console.warn('[addressSelection] 云端获取失败，回退本地:', e);
    }
  }
  
  // 本地兜底（游客态或云端失败）
  const localList = wx.getStorageSync(ADDRESS_STORAGE_KEY) || [];
  return localList.map(normalizeAddressForOrder);
}

module.exports = {
  loadSelectableAddresses,
  pickDefaultAddress,
  normalizeAddressForOrder,
  normalizeAddressFromLocation
};
