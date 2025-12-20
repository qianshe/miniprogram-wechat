// 订单管理云函数
// 支持订单创建、查询、状态更新等功能

const cloud = require('wx-server-sdk');
const {
  ErrorCodes,
  success,
  error,
  paramError,
  permissionError,
  notFoundError,
  wrapHandlerWithTracing
} = require('./_shared/errorHandler');
const {
  filterFields,
  filterFieldsArray,
  createFilterOptions,
  Roles
} = require('./_shared/fieldFilter');
const config = require('./config');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 通过openid验证用户是否为管理员
 * @param {string} openid - 用户的openid
 * @returns {Promise<boolean>} - 是否为管理员
 */
async function verifyAdminByOpenid(openid) {
  if (!openid) return false;
  try {
    const userResult = await db.collection('users')
      .where({ openid })
      .field({ isAdmin: true })
      .get();
    return userResult.data.length > 0 && userResult.data[0].isAdmin === true;
  } catch (err) {
    console.error('[ORDER] verifyAdminByOpenid error:', err);
    return false;
  }
}

// 订单状态枚举
const ORDER_STATUS = {
  PENDING: 0,      // 待支付
  PAID: 1,         // 已支付
  PROCESSING: 2,   // 处理中
  COMPLETED: 3,    // 已完成
  CANCELLED: 4     // 已取消
};

// 配送方式枚举
const DELIVERY_TYPE = {
  PICKUP: 0,       // 自提
  DELIVERY: 1      // 配送
};

/**
 * 创建订单
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function createOrder(data, context, logger) {
  const { OPENID } = cloud.getWXContext();

  logger.info('Creating order', {
    openid: OPENID,
    itemCount: data.items?.length || 0,
    totalAmount: data.totalAmount
  });

  // 数据验证
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return paramError('订单商品不能为空');
  }

  if (!data.totalAmount || data.totalAmount <= 0) {
    return paramError('订单金额必须大于0');
  }
  
  // 生成订单号
  const orderNo = generateOrderNo();
  
  // 验证商品库存
  for (const item of data.items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return paramError('商品信息不完整');
    }
  }
  
  // 从地址对象中提取联系信息
  const addressObj = data.address || {};
  let contactName = data.contactName || '';
  let contactPhone = data.contactPhone || '';
  let addressStr = data.addressString || '';
  
  // 如果地址是对象格式（来自地址选择弹窗），则提取信息
  if (typeof addressObj === 'object' && addressObj !== null) {
    // 提取联系人信息
    contactName = contactName || addressObj.userName || addressObj.name || '';
    contactPhone = contactPhone || addressObj.telNumber || addressObj.phone || '';
    
    // 格式化地址字符串
    if (addressObj.fullAddress) {
      addressStr = addressObj.fullAddress;
    } else if (addressObj.provinceName || addressObj.province) {
      const province = addressObj.provinceName || addressObj.province || '';
      const city = addressObj.cityName || addressObj.city || '';
      const county = addressObj.countyName || addressObj.district || '';
      const detail = addressObj.detailInfo || addressObj.detail || '';
      addressStr = `${province}${city}${county}${detail}`;
    }
  } else if (typeof addressObj === 'string') {
    // 如果地址已经是字符串，直接使用
    addressStr = addressObj;
  }
  
  // 构建订单数据
  const orderData = {
    orderNo,
    userId: data.userId || null,
    userOpenid: OPENID,
    totalAmount: Math.round(data.totalAmount * 100), // 转换为分
    status: ORDER_STATUS.PENDING,
    deliveryType: data.deliveryType || DELIVERY_TYPE.PICKUP,
    items: data.items.map(item => ({
      productId: item.productId,
      productName: item.productName || item.name,
      price: Math.round((item.price || 0) * 100), // 转换为分
      quantity: item.quantity,
      subtotal: Math.round((item.price || 0) * item.quantity * 100),
      productImage: item.productImage || ''
    })),
    contactName: contactName,
    contactPhone: contactPhone,
    serviceTime: data.serviceTime || null,
    address: addressStr,
    remark: data.remark || '',
    waitForBind: data.waitForBind || false, // 是否等待用户绑定
    createTime: new Date(),
    updateTime: new Date()
  };
  
  logger.debug('Order data prepared', {
    orderNo,
    contactName: orderData.contactName,
    contactPhone: orderData.contactPhone,
    address: orderData.address
  });
  
  // 保存订单到数据库
  logger.info('Saving order to database...');
  const result = await db.collection('orders').add({
    data: orderData
  });

  logger.info('Order saved to database', { orderNo, orderId: result._id });

  // 生成二维码URL
  const qrCodeUrl = await generateQRCode(orderNo);

  // 更新订单的二维码URL
  await db.collection('orders').doc(result._id).update({
    data: {
      qrCodeUrl,
      updateTime: new Date()
    }
  });

  logger.info('Order created successfully', { orderNo, orderId: result._id });

  return success({
    orderId: result._id,
    orderNo,
    qrCodeUrl,
    totalAmount: orderData.totalAmount / 100 // 返回时转换为元
  }, '订单创建成功');
}

/**
 * 获取订单列表
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function getOrders(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  
  const {
    page = 1,
    size = 10,
    status,
    userId,
    isAdmin: _clientIsAdmin
  } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Getting orders', { page, size, status, isAdmin });
  
  let query = db.collection('orders');
  
  // 构建查询条件
  const conditions = [];
  
  if (!isAdmin) {
    // 普通用户只能查看自己的订单
    conditions.push({ userOpenid: OPENID });
  }
  
  if (status !== undefined && status !== null) {
    conditions.push({ status: parseInt(status) });
  }
  
  if (conditions.length > 0) {
    query = query.where(_.and(conditions));
  }
  
  // 分页查询
  const skip = (page - 1) * size;
  const ordersResult = await query
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(size)
    .get();
  
  // 获取总数
  const countResult = await query.count();
  
  // 构建字段过滤选项
  const filterOptions = {
    role: isAdmin ? Roles.ADMIN : Roles.USER,
    userId: OPENID
  };
  
  // 格式化订单数据 - 列表查询不返回items以提升性能
  const orders = ordersResult.data.map(order => {
    const { items, ...orderWithoutItems } = order;
    const formattedOrder = {
      ...orderWithoutItems,
      totalAmount: order.totalAmount / 100, // 转换为元
      itemCount: order.items ? order.items.length : 0 // 只返回商品数量
    };
    // 应用字段过滤
    return filterFields(formattedOrder, 'orders', filterOptions);
  });

  logger.info('Orders retrieved', { count: orders.length, total: countResult.total });
  
  return success({
    records: orders,
    total: countResult.total,
    page,
    size,
    hasMore: orders.length === size
  }, '获取订单列表成功');
}

/**
 * 获取订单详情
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function getOrderDetail(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, isAdmin: _clientIsAdmin } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Getting order detail', { orderNo, isAdmin });

  if (!orderNo) {
    return paramError('订单号不能为空');
  }

  // 构建查询条件 - 支持通过_id或orderNo查询
  const conditions = [
    _.or([
      { _id: orderNo },      // 支持通过_id查询
      { orderNo: orderNo }   // 支持通过orderNo查询
    ])
  ];

  if (!isAdmin) {
    // 普通用户只能查看自己的订单
    conditions.push({ userOpenid: OPENID });
  }

  const query = db.collection('orders').where(_.and(conditions));
  const result = await query.get();

  if (result.data.length === 0) {
    logger.warn('Order not found', { orderNo, isAdmin, openid: OPENID });
    return notFoundError('订单');
  }

  const order = result.data[0];

  // 构建字段过滤选项
  const filterOptions = {
    role: isAdmin ? Roles.ADMIN : Roles.USER,
    userId: OPENID
  };

  // 格式化订单数据
  const formattedOrder = {
    ...order,
    totalAmount: order.totalAmount / 100, // 转换为元
    items: order.items.map(item => ({
      ...item,
      price: item.price / 100,
      subtotal: item.subtotal / 100
    }))
  };

  // 应用字段过滤
  // 注意：字段过滤会根据角色和所有权自动处理敏感字段
  // - 管理员可以看到所有字段
  // - 订单所有者可以看到自己订单的所有者级别字段
  // - 其他用户只能看到公开字段，敏感字段会被脱敏
  const filteredOrder = filterFields(formattedOrder, 'orders', filterOptions);

  logger.info('Order detail retrieved', {
    orderNo,
    itemCount: formattedOrder.items.length,
    isOwner: order.userOpenid === OPENID,
    role: filterOptions.role
  });

  return success(filteredOrder, '获取订单详情成功');
}

/**
 * 更新订单状态
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function updateOrderStatus(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, status, isAdmin: _clientIsAdmin } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Updating order status', { orderNo, targetStatus: status, isAdmin });
  
  if (!orderNo || status === undefined) {
    return paramError('订单号和状态不能为空');
  }
  
  // 验证状态值
  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(parseInt(status))) {
    return paramError('无效的订单状态');
  }
  
  // 支持通过_id或orderNo查询
  const whereCondition = _.or([
    { _id: orderNo },
    { orderNo: orderNo }
  ]);

  // 先查询订单
  const orderResult = await db.collection('orders').where(whereCondition).get();
  
  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];
  const targetStatus = parseInt(status);

  // 权限检查
  if (!isAdmin) {
    // 普通用户只能操作自己的订单
    if (order.userOpenid !== OPENID) {
      return permissionError('无权限操作此订单');
    }
    
    // 普通用户只能进行特定状态变更
    // 1. 取消待支付订单: PENDING(0) -> CANCELLED(4)
    // 2. 支付待支付订单: PENDING(0) -> PAID(1) (模拟支付)
    const allowedTransitions = [
      { from: ORDER_STATUS.PENDING, to: ORDER_STATUS.CANCELLED },
      { from: ORDER_STATUS.PENDING, to: ORDER_STATUS.PAID }
    ];
    
    const isAllowed = allowedTransitions.some(
      t => t.from === order.status && t.to === targetStatus
    );
    
    if (!isAllowed) {
      return permissionError('无权限执行此状态变更');
    }
  }

  // 执行更新
  const updateData = {
    status: targetStatus,
    updateTime: new Date()
  };
  
  // 如果是支付操作，添加支付时间
  if (targetStatus === ORDER_STATUS.PAID) {
    updateData.payTime = new Date();
  }
  
  // 如果是进入处理状态，添加处理开始时间
  if (targetStatus === ORDER_STATUS.PROCESSING) {
    updateData.processTime = new Date();
  }
  
  // 如果是完成状态，添加完成时间
  if (targetStatus === ORDER_STATUS.COMPLETED) {
    updateData.completeTime = new Date();
  }

  const updateResult = await db.collection('orders')
    .where(whereCondition)
    .update({
      data: updateData
    });
  
  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '更新订单状态失败');
  }

  logger.info('Order status updated', { orderNo, newStatus: targetStatus });
  
  return success(null, '订单状态更新成功');
}

/**
 * 绑定订单到用户
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function bindOrder(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, userId } = data;

  logger.info('Binding order to user', { orderNo, openid: OPENID });
  
  if (!orderNo) {
    return paramError('订单号不能为空');
  }
  
  const result = await db.collection('orders')
    .where({ 
      orderNo,
      waitForBind: true
    })
    .update({
      data: {
        userId: userId || null,
        userOpenid: OPENID,
        waitForBind: false,
        updateTime: new Date()
      }
    });
  
  if (result.stats.updated === 0) {
    return notFoundError('订单不存在或已绑定');
  }

  logger.info('Order bound successfully', { orderNo });
  
  return success(null, '订单绑定成功');
}

/**
 * 删除订单
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function deleteOrder(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, isAdmin: _clientIsAdmin } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Deleting order', { orderNo, isAdmin });

  if (!orderNo) {
    return paramError('订单号不能为空');
  }

  // 支持通过_id或orderNo查询
  const whereCondition = _.or([
    { _id: orderNo },
    { orderNo: orderNo }
  ]);

  // 先查询订单
  const orderResult = await db.collection('orders').where(whereCondition).get();

  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];

  // 权限检查
  if (!isAdmin) {
    // 普通用户只能删除自己的订单
    if (order.userOpenid !== OPENID) {
      return permissionError('无权限删除此订单');
    }

    // 普通用户只能删除已取消或已完成的订单
    if (order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.COMPLETED) {
      return permissionError('只能删除已取消或已完成的订单');
    }
  }

  // 执行删除
  const deleteResult = await db.collection('orders').where(whereCondition).remove();

  if (deleteResult.stats.removed === 0) {
    return error(ErrorCodes.DB_DELETE_ERROR, '删除订单失败');
  }

  logger.info('Order deleted successfully', { orderNo, deletedCount: deleteResult.stats.removed });

  return success(null, '订单删除成功');
}

/**
 * 生成订单号
 */
function generateOrderNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  return `order_${year}${month}${day}_${random}`;
}

/**
 * 生成二维码URL
 */
async function generateQRCode(orderNo) {
  try {
    // 构建二维码内容 - 小程序页面路径
    const qrCodeContent = `pages/scan-result/scan-result?orderNo=${orderNo}`;

    // 调用微信小程序码生成API
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: orderNo,
      page: 'pages/scan-result/scan-result',
      width: 280,
      autoColor: false,
      lineColor: {
        r: 0,
        g: 0,
        b: 0
      },
      isHyaline: false
    });

    if (result.errCode !== 0) {
      console.error('[QRCode] Failed to generate QR code', result);
      return config.storage.defaultQRCodePath;
    }

    // 将生成的小程序码上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: `qrcodes/${orderNo}.png`,
      fileContent: result.buffer
    });

    if (uploadResult.fileID) {
      return uploadResult.fileID;
    } else {
      console.error('[QRCode] Failed to upload QR code', uploadResult);
      return config.storage.defaultQRCodePath;
    }
  } catch (err) {
    console.error('[QRCode] QR code generation error', err.message);
    return config.storage.defaultQRCodePath;
  }
}

// 主处理逻辑（接收logger作为第三个参数）
const handler = async (event, context, logger) => {
  const { action, data } = event;

  // 使用logger记录action，而不是console.log
  logger.info('Action received', { action });

  if (!action) {
    return paramError('缺少action参数');
  }

  // 将logger传递给各个业务处理函数
  switch (action) {
    case 'createOrder':
      return await createOrder(data, context, logger);
    case 'getOrders':
      return await getOrders(data, context, logger);
    case 'getOrderDetail':
      return await getOrderDetail(data, context, logger);
    case 'updateOrderStatus':
      return await updateOrderStatus(data, context, logger);
    case 'bindOrder':
      return await bindOrder(data, context, logger);
    case 'deleteOrder':
      return await deleteOrder(data, context, logger);
    default:
      logger.warn('Unknown action', { action });
      return paramError(`不支持的操作类型: ${action}`);
  }
};

// 使用带追踪功能的包装器导出处理函数
// wrapHandlerWithTracing 会自动创建logger并传递给handler
exports.main = wrapHandlerWithTracing(handler, { functionName: 'orderManagement' });
