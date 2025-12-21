// 用户数据管理云函数
// 支持地址管理和购物车云端同步

const cloud = require('wx-server-sdk');
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
  const { name, phone, province, city, district, detail, isDefault } = data;

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
    createTime: new Date(),
    updateTime: new Date()
  };

  const result = await db.collection('addresses').add({ data: addressData });

  logger.info('Address added', { addressId: result._id });

  return success({ ...addressData, _id: result._id }, '添加地址成功');
}

async function updateAddress(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { addressId, name, phone, province, city, district, detail, isDefault } = data;

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
      image: item.image || '',
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
  const { productId, name, price, image, quantity = 1 } = data;

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
  const cartItem = {
    userOpenid: OPENID,
    productId,
    name,
    price,
    image: image || '',
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
  const { action, ...data } = event;

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
