// 用户数据管理云函数
// 支持地址管理和购物车云端同步

const cloud = require('wx-server-sdk');
const https = require('https');
const {
  ErrorCodes,
  success,
  error,
  paramError,
  notFoundError,
  wrapHandlerWithTracing
} = require('./_shared/errorHandler');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocationName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveTencentMapKey() {
  const keyCandidates = ['TENCENT_MAP_KEY', 'TENCENT_LBS_KEY', 'QQ_MAP_KEY', 'LBS_KEY'];
  for (const keyName of keyCandidates) {
    const value = normalizeLocationName(process.env[keyName]);
    if (value) {
      return value;
    }
  }
  return '';
}

function requestTencentJson(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      let rawData = '';

      response.on('data', (chunk) => {
        rawData += chunk;
      });

      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP_${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(rawData || '{}'));
        } catch (err) {
          reject(new Error('INVALID_JSON_RESPONSE'));
        }
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy(new Error('REQUEST_TIMEOUT'));
    });

    req.on('error', reject);
  });
}

function createFallbackGeocodeResult({ latitude, longitude, locationName, locationAddress } = {}) {
  return {
    province: '',
    city: '',
    district: '',
    detail: normalizeLocationName(locationAddress),
    locationName: normalizeLocationName(locationName),
    locationAddress: normalizeLocationName(locationAddress),
    latitude: normalizeCoordinate(latitude),
    longitude: normalizeCoordinate(longitude),
    hasStructuredRegion: false,
    source: 'fallback'
  };
}

function createForwardGeocodeFallbackResult({ province, city, district, detail, locationName, locationAddress, addressText } = {}) {
  const normalizedAddressText = normalizeLocationName(addressText);
  const normalizedLocationAddress = normalizeLocationName(locationAddress) || normalizedAddressText;
  return {
    province: normalizeLocationName(province),
    city: normalizeLocationName(city),
    district: normalizeLocationName(district),
    detail: normalizeLocationName(detail),
    locationName: normalizeLocationName(locationName),
    locationAddress: normalizedLocationAddress,
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    source: 'fallback'
  };
}

function mapTencentReverseGeocodeResponse(payload = {}, fallback = {}) {
  const result = payload.result || {};
  const addressComponent = result.address_component || {};
  const formattedAddresses = result.formatted_addresses || {};
  const pois = Array.isArray(result.pois) ? result.pois : [];
  const firstPoi = pois[0] || {};

  const province = normalizeLocationName(addressComponent.province);
  const city = normalizeLocationName(addressComponent.city);
  const district = normalizeLocationName(addressComponent.district);
  const detail = normalizeLocationName(`${normalizeLocationName(addressComponent.street)}${normalizeLocationName(addressComponent.street_number)}`)
    || normalizeLocationName(result.address)
    || normalizeLocationName(fallback.locationAddress);
  const locationName = normalizeLocationName(fallback.locationName)
    || normalizeLocationName(formattedAddresses.recommend)
    || normalizeLocationName(firstPoi.title || firstPoi.name)
    || normalizeLocationName(result.address);
  const locationAddress = normalizeLocationName(fallback.locationAddress)
    || normalizeLocationName(result.address)
    || normalizeLocationName(formattedAddresses.rough);

  return {
    province,
    city,
    district,
    detail,
    locationName,
    locationAddress,
    latitude: normalizeCoordinate(fallback.latitude),
    longitude: normalizeCoordinate(fallback.longitude),
    hasStructuredRegion: Boolean(province && city && district),
    source: 'tencent'
  };
}

function mapTencentForwardGeocodeResponse(payload = {}, fallback = {}) {
  const result = payload.result || {};
  const location = result.location || {};
  const adInfo = result.ad_info || {};

  const latitude = normalizeCoordinate(location.lat !== undefined ? location.lat : location.latitude);
  const longitude = normalizeCoordinate(location.lng !== undefined ? location.lng : location.longitude);

  const province = normalizeLocationName(fallback.province) || normalizeLocationName(adInfo.province);
  const city = normalizeLocationName(fallback.city) || normalizeLocationName(adInfo.city);
  const district = normalizeLocationName(fallback.district) || normalizeLocationName(adInfo.district);
  const detail = normalizeLocationName(fallback.detail)
    || normalizeLocationName(result.address)
    || normalizeLocationName(fallback.locationAddress);
  const locationName = normalizeLocationName(fallback.locationName)
    || normalizeLocationName(result.title)
    || normalizeLocationName(result.address);
  const locationAddress = normalizeLocationName(fallback.locationAddress)
    || normalizeLocationName(result.address)
    || normalizeLocationName(result.title);

  return {
    province,
    city,
    district,
    detail,
    locationName,
    locationAddress,
    latitude,
    longitude,
    hasCoordinates: latitude !== null && longitude !== null,
    source: 'tencent'
  };
}

function resolveCartImage(source = {}) {
  return source.coverImage || source.productImage || source.image || source.thumb || source.imageUrl || (Array.isArray(source.images) ? source.images[0] : '') || '';
}

// ============ 地址管理 ============

async function getAddressList(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  logger.info('Getting address list', { openid: OPENID });

  const result = await db.collection('addresses')
    .where({ userOpenid: OPENID })
    .orderBy('isDefault', 'desc')
    .orderBy('updateTime', 'desc')
    .get();

  return success(result.data, '获取地址列表成功');
}

async function addAddress(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const {
    name,
    phone,
    province,
    city,
    district,
    detail,
    isDefault,
    locationName,
    locationAddress,
    latitude,
    longitude
  } = data;

  const normalizedLocationName = normalizeLocationName(locationName);
  const normalizedLocationAddress = normalizeLocationName(locationAddress);
  const normalizedLatitude = normalizeCoordinate(latitude);
  const normalizedLongitude = normalizeCoordinate(longitude);

  logger.info('Adding address', { openid: OPENID, name });

  if (!name || !phone || !province || !detail) {
    return paramError('地址信息不完整');
  }

  if (!/^1\d{10}$/.test(phone)) {
    return paramError('手机号格式不正确');
  }

  // 如果设置为默认，先取消其他默认地址
  if (isDefault) {
    await db.collection('addresses')
      .where({ userOpenid: OPENID, isDefault: true })
      .update({ data: { isDefault: false, updateTime: new Date() } });
  }

  // 检查是否是第一个地址，自动设为默认
  const countResult = await db.collection('addresses')
    .where({ userOpenid: OPENID })
    .count();
  const shouldBeDefault = isDefault || countResult.total === 0;

  const addressData = {
    userOpenid: OPENID,
    name: name.trim(),
    phone: phone.trim(),
    province,
    city: city || '',
    district: district || '',
    detail: detail.trim(),
    isDefault: shouldBeDefault,
    locationName: normalizedLocationName,
    locationAddress: normalizedLocationAddress,
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    createTime: new Date(),
    updateTime: new Date()
  };

  const result = await db.collection('addresses').add({ data: addressData });

  logger.info('Address added', { addressId: result._id });

  return success({ ...addressData, _id: result._id }, '添加地址成功');
}

async function updateAddress(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const {
    addressId,
    name,
    phone,
    province,
    city,
    district,
    detail,
    isDefault,
    locationName,
    locationAddress,
    latitude,
    longitude
  } = data;

  logger.info('Updating address', { openid: OPENID, addressId });

  if (!addressId) {
    return paramError('地址ID不能为空');
  }

  // 验证地址归属
  const addressResult = await db.collection('addresses')
    .where({ _id: addressId, userOpenid: OPENID })
    .get();

  if (addressResult.data.length === 0) {
    return notFoundError('地址');
  }

  // 如果设置为默认，先取消其他默认地址
  if (isDefault) {
    await db.collection('addresses')
      .where({ userOpenid: OPENID, isDefault: true, _id: _.neq(addressId) })
      .update({ data: { isDefault: false, updateTime: new Date() } });
  }

  const updateData = {
    updateTime: new Date()
  };

  if (name) updateData.name = name.trim();
  if (phone) updateData.phone = phone.trim();
  if (province !== undefined) updateData.province = province;
  if (city !== undefined) updateData.city = city;
  if (district !== undefined) updateData.district = district;
  if (detail) updateData.detail = detail.trim();
  if (isDefault !== undefined) updateData.isDefault = isDefault;
  if (locationName !== undefined) updateData.locationName = normalizeLocationName(locationName);
  if (locationAddress !== undefined) updateData.locationAddress = normalizeLocationName(locationAddress);
  if (latitude !== undefined) updateData.latitude = normalizeCoordinate(latitude);
  if (longitude !== undefined) updateData.longitude = normalizeCoordinate(longitude);

  await db.collection('addresses').doc(addressId).update({ data: updateData });

  logger.info('Address updated', { addressId });

  return success(null, '更新地址成功');
}

async function deleteAddress(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { addressId } = data;

  logger.info('Deleting address', { openid: OPENID, addressId });

  if (!addressId) {
    return paramError('地址ID不能为空');
  }

  // 验证地址归属
  const addressResult = await db.collection('addresses')
    .where({ _id: addressId, userOpenid: OPENID })
    .get();

  if (addressResult.data.length === 0) {
    return notFoundError('地址');
  }

  const wasDefault = addressResult.data[0].isDefault;

  await db.collection('addresses').doc(addressId).remove();

  // 如果删除的是默认地址，将第一个地址设为默认
  if (wasDefault) {
    const remaining = await db.collection('addresses')
      .where({ userOpenid: OPENID })
      .orderBy('createTime', 'asc')
      .limit(1)
      .get();

    if (remaining.data.length > 0) {
      await db.collection('addresses').doc(remaining.data[0]._id)
        .update({ data: { isDefault: true, updateTime: new Date() } });
    }
  }

  logger.info('Address deleted', { addressId });

  return success(null, '删除地址成功');
}

async function setDefaultAddress(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { addressId } = data;

  logger.info('Setting default address', { openid: OPENID, addressId });

  if (!addressId) {
    return paramError('地址ID不能为空');
  }

  // 验证地址归属
  const addressResult = await db.collection('addresses')
    .where({ _id: addressId, userOpenid: OPENID })
    .get();

  if (addressResult.data.length === 0) {
    return notFoundError('地址');
  }

  // 取消其他默认地址
  await db.collection('addresses')
    .where({ userOpenid: OPENID, isDefault: true })
    .update({ data: { isDefault: false, updateTime: new Date() } });

  // 设置新的默认地址
  await db.collection('addresses').doc(addressId)
    .update({ data: { isDefault: true, updateTime: new Date() } });

  logger.info('Default address set', { addressId });

  return success(null, '设置默认地址成功');
}

async function reverseGeocodeLocation(data, context, logger) {
  const latitude = normalizeCoordinate(data && data.latitude);
  const longitude = normalizeCoordinate(data && data.longitude);
  const locationName = normalizeLocationName(data && data.locationName);
  const locationAddress = normalizeLocationName(data && data.locationAddress);

  if (latitude === null || longitude === null) {
    return paramError('经纬度不能为空');
  }

  const fallbackResult = createFallbackGeocodeResult({
    latitude,
    longitude,
    locationName,
    locationAddress
  });

  const key = resolveTencentMapKey();
  if (!key) {
    logger.warn('Tencent map key missing for reverse geocode');
    return success(
      {
        ...fallbackResult,
        geocodeStatus: 'missing_key'
      },
      '逆地理编码未配置，请手动选择所在地区'
    );
  }

  const requestUrl = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
  requestUrl.searchParams.set('location', `${latitude},${longitude}`);
  requestUrl.searchParams.set('key', key);
  requestUrl.searchParams.set('get_poi', '1');

  try {
    const payload = await requestTencentJson(requestUrl.toString(), 8000);
    const statusCode = Number(payload && payload.status);

    if (statusCode !== 0) {
      logger.warn('Reverse geocode returned non-zero status', {
        statusCode,
        message: payload && payload.message
      });
      return success(
        {
          ...fallbackResult,
          geocodeStatus: 'service_error',
          geocodeCode: statusCode,
          geocodeMessage: normalizeLocationName(payload && payload.message)
        },
        '逆地理编码未完整返回，请手动选择所在地区'
      );
    }

    const mapped = mapTencentReverseGeocodeResponse(payload, {
      latitude,
      longitude,
      locationName,
      locationAddress
    });

    if (!mapped.hasStructuredRegion) {
      return success(
        {
          ...mapped,
          geocodeStatus: 'partial'
        },
        '逆地理编码部分成功，请手动选择所在地区'
      );
    }

    return success(
      {
        ...mapped,
        geocodeStatus: 'ok'
      },
      '逆地理编码成功'
    );
  } catch (requestError) {
    logger.error('Reverse geocode request failed', requestError, {
      latitude,
      longitude
    });
    return success(
      {
        ...fallbackResult,
        geocodeStatus: 'request_failed',
        geocodeMessage: normalizeLocationName(requestError && requestError.message)
      },
      '逆地理编码失败，请手动选择所在地区'
    );
  }
}

async function geocodeAddress(data, context, logger) {
  const province = normalizeLocationName(data && data.province);
  const city = normalizeLocationName(data && data.city);
  const district = normalizeLocationName(data && data.district);
  const detail = normalizeLocationName(data && data.detail);
  const locationName = normalizeLocationName(data && data.locationName);
  const locationAddress = normalizeLocationName(data && data.locationAddress);
  const addressText = normalizeLocationName(data && data.addressText)
    || normalizeLocationName(`${province}${city}${district}${detail}`)
    || locationAddress
    || locationName;

  if (!addressText) {
    return paramError('地址信息不能为空');
  }

  const fallbackResult = createForwardGeocodeFallbackResult({
    province,
    city,
    district,
    detail,
    locationName,
    locationAddress,
    addressText
  });

  const key = resolveTencentMapKey();
  if (!key) {
    logger.warn('Tencent map key missing for geocode address');
    return success(
      {
        ...fallbackResult,
        geocodeStatus: 'missing_key'
      },
      '地址地理编码未配置，请先补充地图坐标'
    );
  }

  const requestUrl = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
  requestUrl.searchParams.set('address', addressText);
  requestUrl.searchParams.set('key', key);

  try {
    const payload = await requestTencentJson(requestUrl.toString(), 8000);
    const statusCode = Number(payload && payload.status);

    if (statusCode !== 0) {
      logger.warn('Geocode address returned non-zero status', {
        statusCode,
        message: payload && payload.message,
        addressText
      });
      return success(
        {
          ...fallbackResult,
          geocodeStatus: 'service_error',
          geocodeCode: statusCode,
          geocodeMessage: normalizeLocationName(payload && payload.message)
        },
        '地址地理编码失败，请检查地址后重试'
      );
    }

    const mapped = mapTencentForwardGeocodeResponse(payload, fallbackResult);
    if (!mapped.hasCoordinates) {
      return success(
        {
          ...mapped,
          geocodeStatus: 'partial'
        },
        '地址地理编码未返回坐标，请补充地图选点'
      );
    }

    return success(
      {
        ...mapped,
        geocodeStatus: 'ok'
      },
      '地址地理编码成功'
    );
  } catch (requestError) {
    logger.error('Geocode address request failed', requestError, {
      addressText
    });
    return success(
      {
        ...fallbackResult,
        geocodeStatus: 'request_failed',
        geocodeMessage: normalizeLocationName(requestError && requestError.message)
      },
      '地址地理编码请求失败，请稍后重试'
    );
  }
}

// ============ 购物车管理 ============

async function getCartList(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  logger.info('Getting cart list', { openid: OPENID });

  const result = await db.collection('carts')
    .where({ userOpenid: OPENID })
    .orderBy('updateTime', 'desc')
    .get();

  return success(result.data, '获取购物车成功');
}

async function syncCart(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { items } = data;

  logger.info('Syncing cart', { openid: OPENID, itemCount: items?.length || 0 });

  if (!Array.isArray(items)) {
    return paramError('购物车数据格式错误');
  }

  // 删除用户现有购物车数据
  await db.collection('carts')
    .where({ userOpenid: OPENID })
    .remove();

  // 批量添加新数据
  if (items.length > 0) {
    const cartItems = items.map(item => ({
      userOpenid: OPENID,
      productId: item.id || item.productId,
      name: item.name,
      price: item.price,
      image: resolveCartImage(item),
      quantity: item.quantity || 1,
      selected: item.selected || false,
      createTime: new Date(),
      updateTime: new Date()
    }));

    // 逐条添加（云开发不支持批量add）
    for (const item of cartItems) {
      await db.collection('carts').add({ data: item });
    }
  }

  logger.info('Cart synced', { itemCount: items.length });

  return success(null, '购物车同步成功');
}

async function addToCart(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { productId, name, price, image, coverImage, productImage, thumb, imageUrl, images, quantity = 1 } = data;

  logger.info('Adding to cart', { openid: OPENID, productId });

  if (!productId || !name || price === undefined) {
    return paramError('商品信息不完整');
  }

  // 检查商品是否已在购物车
  const existing = await db.collection('carts')
    .where({ userOpenid: OPENID, productId })
    .get();

  if (existing.data.length > 0) {
    // 更新数量
    const newQuantity = existing.data[0].quantity + quantity;
    await db.collection('carts').doc(existing.data[0]._id)
      .update({ data: { quantity: newQuantity, updateTime: new Date() } });

    logger.info('Cart item quantity updated', { productId, newQuantity });
    return success({ quantity: newQuantity }, '商品数量已更新');
  }

  // 添加新商品
  const snapshotImage = resolveCartImage({ image, coverImage, productImage, thumb, imageUrl, images });
  const cartItem = {
    userOpenid: OPENID,
    productId,
    name,
    price,
    image: snapshotImage,
    quantity,
    selected: false,
    createTime: new Date(),
    updateTime: new Date()
  };

  const result = await db.collection('carts').add({ data: cartItem });

  logger.info('Item added to cart', { cartItemId: result._id });

  return success({ ...cartItem, _id: result._id }, '添加购物车成功');
}

async function updateCartItem(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { cartItemId, quantity, selected } = data;

  logger.info('Updating cart item', { openid: OPENID, cartItemId });

  if (!cartItemId) {
    return paramError('购物车项ID不能为空');
  }

  // 验证归属
  const itemResult = await db.collection('carts')
    .where({ _id: cartItemId, userOpenid: OPENID })
    .get();

  if (itemResult.data.length === 0) {
    return notFoundError('购物车项');
  }

  const updateData = { updateTime: new Date() };
  if (quantity !== undefined) updateData.quantity = quantity;
  if (selected !== undefined) updateData.selected = selected;

  await db.collection('carts').doc(cartItemId).update({ data: updateData });

  logger.info('Cart item updated', { cartItemId });

  return success(null, '更新成功');
}

async function removeFromCart(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { cartItemId, productId } = data;

  logger.info('Removing from cart', { openid: OPENID, cartItemId, productId });

  if (!cartItemId && !productId) {
    return paramError('请提供购物车项ID或商品ID');
  }

  const whereCondition = { userOpenid: OPENID };
  if (cartItemId) {
    whereCondition._id = cartItemId;
  } else {
    whereCondition.productId = productId;
  }

  const result = await db.collection('carts').where(whereCondition).remove();

  if (result.stats.removed === 0) {
    return notFoundError('购物车项');
  }

  logger.info('Item removed from cart', { removed: result.stats.removed });

  return success(null, '删除成功');
}

async function clearCart(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { selectedOnly } = data;

  logger.info('Clearing cart', { openid: OPENID, selectedOnly });

  const whereCondition = { userOpenid: OPENID };
  if (selectedOnly) {
    whereCondition.selected = true;
  }

  const result = await db.collection('carts').where(whereCondition).remove();

  logger.info('Cart cleared', { removed: result.stats.removed });

  return success({ removed: result.stats.removed }, '清空成功');
}

// 主处理逻辑
const handler = async (event, context, logger) => {
  const { action, data } = event;

  logger.info('Action received', { action });

  if (!action) {
    return paramError('缺少action参数');
  }

  switch (action) {
    // 地址管理
    case 'getAddressList':
      return await getAddressList(data, context, logger);
    case 'addAddress':
      return await addAddress(data, context, logger);
    case 'updateAddress':
      return await updateAddress(data, context, logger);
    case 'deleteAddress':
      return await deleteAddress(data, context, logger);
    case 'setDefaultAddress':
      return await setDefaultAddress(data, context, logger);
    case 'reverseGeocodeLocation':
      return await reverseGeocodeLocation(data, context, logger);
    case 'geocodeAddress':
      return await geocodeAddress(data, context, logger);

    // 购物车管理
    case 'getCartList':
      return await getCartList(data, context, logger);
    case 'syncCart':
      return await syncCart(data, context, logger);
    case 'addToCart':
      return await addToCart(data, context, logger);
    case 'updateCartItem':
      return await updateCartItem(data, context, logger);
    case 'removeFromCart':
      return await removeFromCart(data, context, logger);
    case 'clearCart':
      return await clearCart(data, context, logger);

    default:
      logger.warn('Unknown action', { action });
      return paramError(`不支持的操作类型: ${action}`);
  }
};

exports.main = wrapHandlerWithTracing(handler, { functionName: 'userDataManagement' });
