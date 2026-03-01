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

// 订单状态枚举（旧字段，保留兼容）
const ORDER_STATUS = {
  PENDING: 0,      // 待支付
  PAID: 1,         // 已支付
  PROCESSING: 2,   // 处理中
  COMPLETED: 3,    // 已完成（已结清闭环）
  CANCELLED: 4,    // 已取消
  SERVED_UNPAID: 5 // 已服务待付款（先服务后付款场景）
};

// 新订单流程状态枚举（双字段系统）
const ORDER_FLOW_STATUS = {
  CREATED: 0,      // 已创建
  PROCESSING: 1,   // 服务中
  SERVICE_DONE: 2, // 服务完成
  COMPLETED: 3,    // 已完成（已结清）
  CANCELLED: 4     // 已取消
};

// 支付状态枚举（双字段系统）
const PAYMENT_STATUS = {
  UNPAID: 0,       // 未支付
  PAID: 1          // 已支付
};

/**
 * 旧status到新字段映射
 * @param {number} status - 旧的订单状态
 * @param {Date|null} payTime - 支付时间
 * @returns {object} - { orderStatus, paymentStatus }
 */
function mapLegacyStatusToNew(status, payTime) {
  const mapping = {
    0: { orderStatus: 0, paymentStatus: 0 },  // PENDING -> CREATED + UNPAID
    1: { orderStatus: 0, paymentStatus: 1 },  // PAID -> CREATED + PAID
    2: { orderStatus: 1, paymentStatus: payTime ? 1 : 0 },  // PROCESSING -> PROCESSING + (based on payTime)
    3: { orderStatus: 3, paymentStatus: 1 },  // COMPLETED -> COMPLETED + PAID
    4: { orderStatus: 4, paymentStatus: payTime ? 1 : 0 },  // CANCELLED -> CANCELLED + (based on payTime)
    5: { orderStatus: 2, paymentStatus: 0 }   // SERVED_UNPAID -> SERVICE_DONE + UNPAID
  };
  return mapping[status] || { orderStatus: 0, paymentStatus: 0 };
}

/**
 * 新字段到旧status映射
 * @param {number} orderStatus - 订单流程状态
 * @param {number} paymentStatus - 支付状态
 * @returns {number} - 旧的订单状态
 */
function mapNewStatusToLegacy(orderStatus, paymentStatus) {
  if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) return ORDER_STATUS.CANCELLED; // CANCELLED
  if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) return ORDER_STATUS.COMPLETED; // COMPLETED
  if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE && paymentStatus === PAYMENT_STATUS.UNPAID) return ORDER_STATUS.SERVED_UNPAID; // SERVICE_DONE + UNPAID
  if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) return ORDER_STATUS.PROCESSING; // PROCESSING
  if (orderStatus === ORDER_FLOW_STATUS.CREATED && paymentStatus === PAYMENT_STATUS.PAID) return ORDER_STATUS.PAID; // CREATED + PAID
  return ORDER_STATUS.PENDING; // CREATED + UNPAID
}

// 支付方式枚举
const PAYMENT_METHOD = {
  ONLINE: 'online',     // 线上支付（微信支付）
  OFFLINE: 'offline',   // 线下收款（现金/转账等）
  NOT_PAID: 'not_paid'  // 未支付
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
    // 新增双字段状态
    orderStatus: ORDER_FLOW_STATUS.CREATED,
    paymentStatus: PAYMENT_STATUS.UNPAID,
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
    orderStatus,
    paymentStatus,
    userId,
    isAdmin: _clientIsAdmin
  } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Getting orders', { page, size, status, orderStatus, paymentStatus, isAdmin });
  
  let query = db.collection('orders');
  
  // 构建查询条件
  const conditions = [];
  
  if (!isAdmin) {
    // 普通用户只能查看自己的订单
    conditions.push({ userOpenid: OPENID });
  }
  
  // 支持新的 orderStatus 和 paymentStatus 查询参数
  if (orderStatus !== undefined && orderStatus !== null) {
    conditions.push({ orderStatus: parseInt(orderStatus) });
  }
  
  if (paymentStatus !== undefined && paymentStatus !== null) {
    conditions.push({ paymentStatus: parseInt(paymentStatus) });
  }
  
  // 兼容旧的 status 参数（如果新参数未提供，则使用旧参数）
  if (status !== undefined && status !== null && orderStatus === undefined && paymentStatus === undefined) {
    conditions.push({ status: parseInt(status) });
  }
  
  if (conditions.length > 0) {
    query = query.where(_.and(conditions));
  }

  // 分页查询 - 并行执行查询和计数，提升性能
  const skip = (page - 1) * size;
  const [ordersResult, countResult] = await Promise.all([
    query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(size)
      .get(),
    query.count()
  ]);
  
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
 * 提交线下结算意向
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function submitOfflineSettlementIntent(data, context, logger) {
  const { orderNo, paymentNote, isAdmin } = data || {};

  logger.info('Submitting offline settlement intent', {
    orderNo,
    hasPaymentNote: paymentNote !== undefined
  });

  // 复用 updateOrderStatus 的核心状态流转逻辑
  const statusUpdateResult = await updateOrderStatus(
    {
      orderNo,
      status: ORDER_STATUS.PAID,
      isAdmin
    },
    context,
    logger
  );

  if (statusUpdateResult.code !== ErrorCodes.SUCCESS) {
    return statusUpdateResult;
  }

  // 覆盖支付方式为线下，并可选记录付款备注
  const whereCondition = _.or([
    { _id: orderNo },
    { orderNo: orderNo }
  ]);

  const updateData = {
    paymentMethod: PAYMENT_METHOD.OFFLINE,
    updateTime: new Date()
  };

  if (paymentNote !== undefined) {
    updateData.paymentNote = paymentNote;
  }

  const updateResult = await db.collection('orders')
    .where(whereCondition)
    .update({
      data: updateData
    });

  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '提交线下结算意向失败');
  }

  logger.info('Offline settlement intent submitted', { orderNo });
  return success(null, '线下结算意向提交成功');
}

/**
 * @deprecated 请使用 submitOfflineSettlementIntent
 * 保留用于向后兼容
 */
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
    // 2. 支付待支付订单: PENDING(0) -> PAID(1)
    // 3. 服务中付款: PROCESSING(2) -> PAID(1) (实际只记录payTime，不改状态)
    // 4. 已服务待付款付款: SERVED_UNPAID(5) -> PAID(1) (实际变为COMPLETED)
    const allowedTransitions = [
      { from: ORDER_STATUS.PENDING, to: ORDER_STATUS.CANCELLED },
      { from: ORDER_STATUS.PENDING, to: ORDER_STATUS.PAID },
      { from: ORDER_STATUS.PROCESSING, to: ORDER_STATUS.PAID },
      { from: ORDER_STATUS.SERVED_UNPAID, to: ORDER_STATUS.PAID }
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
    updateTime: new Date()
  };
  
  // 支付逻辑：根据当前状态决定目标状态
  if (targetStatus === ORDER_STATUS.PAID) {
    updateData.payTime = new Date();
    // updateData.paymentMethod = PAYMENT_METHOD.ONLINE; // 已移除硬编码，改为线下结算模式
    
    if (order.status === ORDER_STATUS.PROCESSING) {
      // 服务中付款：保持服务中状态，只记录支付信息
      updateData.status = ORDER_STATUS.PROCESSING;
      // 双写：更新支付状态，保持订单流程状态
      updateData.paymentStatus = PAYMENT_STATUS.PAID;
    } else if (order.status === ORDER_STATUS.SERVED_UNPAID) {
      // 已服务待付款付款：直接进入完成状态
      updateData.status = ORDER_STATUS.COMPLETED;
      updateData.completeTime = new Date();
      // 双写：服务完成且已付款 -> 完成
      updateData.orderStatus = ORDER_FLOW_STATUS.COMPLETED;
      updateData.paymentStatus = PAYMENT_STATUS.PAID;
    } else {
      // 待支付付款：进入已支付状态
      updateData.status = ORDER_STATUS.PAID;
      // 双写：已创建 + 已支付
      updateData.paymentStatus = PAYMENT_STATUS.PAID;
    }
  } else {
    updateData.status = targetStatus;
    // 双写：根据旧status推导新字段
    const newFields = mapLegacyStatusToNew(targetStatus, order.payTime);
    updateData.orderStatus = newFields.orderStatus;
    updateData.paymentStatus = newFields.paymentStatus;
  }
  
  // 如果是进入处理状态，添加处理开始时间
  if (targetStatus === ORDER_STATUS.PROCESSING) {
    updateData.processTime = new Date();
    // 双写：进入处理状态
    updateData.orderStatus = ORDER_FLOW_STATUS.PROCESSING;
  }
  
  // 如果是完成状态，添加完成时间
  if (targetStatus === ORDER_STATUS.COMPLETED) {
    updateData.completeTime = new Date();
    // 双写：完成状态
    updateData.orderStatus = ORDER_FLOW_STATUS.COMPLETED;
    updateData.paymentStatus = PAYMENT_STATUS.PAID;
  }

  // 如果是已服务待付款状态，设置付款截止时间（7天）
  if (targetStatus === ORDER_STATUS.SERVED_UNPAID) {
    updateData.serviceCompletedAt = new Date();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    updateData.payDeadlineAt = deadline;
    updateData.paymentMethod = PAYMENT_METHOD.NOT_PAID;
    // 双写：服务完成 + 未支付
    updateData.orderStatus = ORDER_FLOW_STATUS.SERVICE_DONE;
    updateData.paymentStatus = PAYMENT_STATUS.UNPAID;
  }

  // 如果是取消状态
  if (targetStatus === ORDER_STATUS.CANCELLED) {
    // 双写：取消状态
    updateData.orderStatus = ORDER_FLOW_STATUS.CANCELLED;
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
 * 标记服务完成（先服务后付款场景）
 * 管理员将订单从 PENDING/PAID/PROCESSING 状态转为 SERVED_UNPAID
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function markServiceCompleted(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, payDeadlineDays = 7 } = data;

  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('仅管理员可执行此操作');
  }

  logger.info('Marking service completed', { orderNo, payDeadlineDays });

  if (!orderNo) {
    return paramError('订单号不能为空');
  }

  const whereCondition = _.or([{ _id: orderNo }, { orderNo: orderNo }]);
  const orderResult = await db.collection('orders').where(whereCondition).get();

  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];

  // 允许从 PROCESSING 状态标记服务完成
  if (order.status !== ORDER_STATUS.PROCESSING) {
    return paramError('只有服务中的订单才能标记服务完成');
  }

  const now = new Date();
  
  // 判断是否已付款
  const isPaid = !!order.payTime || (order.paymentMethod && order.paymentMethod !== PAYMENT_METHOD.NOT_PAID);

  let updateData;
  let message;

  if (isPaid) {
    // 已付款 -> 直接完成
    updateData = {
      status: ORDER_STATUS.COMPLETED,
      serviceCompletedAt: now,
      completeTime: now,
      serviceOperatorOpenid: OPENID,
      updateTime: now
    };
    message = '服务已完成';
  } else {
    // 未付款 -> 已服务待付款
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + payDeadlineDays);
    updateData = {
      status: ORDER_STATUS.SERVED_UNPAID,
      serviceCompletedAt: now,
      payDeadlineAt: deadline,
      paymentMethod: PAYMENT_METHOD.NOT_PAID,
      serviceOperatorOpenid: OPENID,
      updateTime: now
    };
    message = '已标记服务完成，等待用户付款';
  }

  const updateResult = await db.collection('orders').where(whereCondition).update({ data: updateData });

  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '标记服务完成失败');
  }

  logger.info('Service marked as completed', { orderNo, isPaid, newStatus: updateData.status });
  return success({ isPaid, status: updateData.status }, message);
}

/**
 * 记录线下收款（管理员手动确认收款）
 * 将 SERVED_UNPAID 或 PENDING 状态的订单标记为已支付
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function recordOfflinePayment(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, paymentNote = '' } = data;

  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('仅管理员可执行此操作');
  }

  logger.info('Recording offline payment', { orderNo });

  if (!orderNo) {
    return paramError('订单号不能为空');
  }

  const whereCondition = _.or([{ _id: orderNo }, { orderNo: orderNo }]);
  const orderResult = await db.collection('orders').where(whereCondition).get();

  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];

  // 允许从 PENDING、PROCESSING 或 SERVED_UNPAID 状态记录线下收款
  const allowedStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SERVED_UNPAID];
  if (!allowedStatuses.includes(order.status)) {
    return paramError('当前订单状态不允许记录线下收款');
  }

  const now = new Date();
  let updateData;

  if (order.status === ORDER_STATUS.SERVED_UNPAID) {
    // 已服务待付款 -> 收款后直接完成
    updateData = {
      status: ORDER_STATUS.COMPLETED,
      orderStatus: ORDER_FLOW_STATUS.COMPLETED,
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMethod: PAYMENT_METHOD.OFFLINE,
      payTime: now,
      completeTime: now,
      paymentNote: paymentNote,
      paymentOperatorOpenid: OPENID,
      updateTime: now
    };
  } else {
    // PENDING/PROCESSING -> 收款后变为已支付
    updateData = {
      status: ORDER_STATUS.PAID,
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMethod: PAYMENT_METHOD.OFFLINE,
      payTime: now,
      paymentNote: paymentNote,
      paymentOperatorOpenid: OPENID,
      updateTime: now
    };
  }

  const updateResult = await db.collection('orders').where(whereCondition).update({ data: updateData });

  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '记录线下收款失败');
  }

  logger.info('Offline payment recorded', { orderNo });
  return success(null, '线下收款已记录');
}

/**
 * 更新订单流程状态（新API - 双字段系统）
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function updateOrderFlowStatus(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderId, orderNo, orderStatus } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('仅管理员可执行此操作');
  }

  logger.info('Updating order flow status', { orderId, orderNo, orderStatus });

  // 参数验证
  const orderIdentifier = orderId || orderNo;
  if (!orderIdentifier) {
    return paramError('订单ID或订单号不能为空');
  }

  if (orderStatus === undefined || orderStatus === null) {
    return paramError('订单流程状态不能为空');
  }

  // 验证 orderStatus 是否为有效值
  const validOrderStatuses = Object.values(ORDER_FLOW_STATUS);
  if (!validOrderStatuses.includes(parseInt(orderStatus))) {
    return paramError('无效的订单流程状态');
  }

  const targetOrderStatus = parseInt(orderStatus);

  // 查询订单
  const whereCondition = _.or([
    { _id: orderIdentifier },
    { orderNo: orderIdentifier }
  ]);

  const orderResult = await db.collection('orders').where(whereCondition).get();

  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];
  const currentPaymentStatus = order.paymentStatus !== undefined ? order.paymentStatus : PAYMENT_STATUS.UNPAID;

  // 构建更新数据
  const updateData = {
    orderStatus: targetOrderStatus,
    updateTime: new Date()
  };

  // 双写：根据新字段推导旧 status
  updateData.status = mapNewStatusToLegacy(targetOrderStatus, currentPaymentStatus);

  // 特殊处理：如果 orderStatus=SERVICE_DONE 且 paymentStatus=PAID，自动推进到 COMPLETED
  if (targetOrderStatus === ORDER_FLOW_STATUS.SERVICE_DONE && currentPaymentStatus === PAYMENT_STATUS.PAID) {
    updateData.orderStatus = ORDER_FLOW_STATUS.COMPLETED;
    updateData.status = ORDER_STATUS.COMPLETED;
    updateData.completeTime = new Date();
    logger.info('Auto-advancing to COMPLETED (service done + paid)', { orderId: orderIdentifier });
  }

  // 添加状态相关的时间戳
  if (targetOrderStatus === ORDER_FLOW_STATUS.PROCESSING) {
    updateData.processTime = new Date();
  }
  if (targetOrderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) {
    updateData.serviceCompletedAt = new Date();
  }
  if (updateData.orderStatus === ORDER_FLOW_STATUS.COMPLETED) {
    updateData.completeTime = updateData.completeTime || new Date();
  }

  const updateResult = await db.collection('orders').where(whereCondition).update({
    data: updateData
  });

  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '更新订单流程状态失败');
  }

  logger.info('Order flow status updated', {
    orderId: orderIdentifier,
    newOrderStatus: updateData.orderStatus,
    newLegacyStatus: updateData.status
  });

  return success({
    orderStatus: updateData.orderStatus,
    status: updateData.status
  }, '订单流程状态更新成功');
}

/**
 * 更新支付状态（新API - 双字段系统）
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function updatePaymentStatus(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderId, orderNo, paymentStatus, paymentMethod, paymentNote } = data;

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('仅管理员可执行此操作');
  }

  logger.info('Updating payment status', { orderId, orderNo, paymentStatus });

  // 参数验证
  const orderIdentifier = orderId || orderNo;
  if (!orderIdentifier) {
    return paramError('订单ID或订单号不能为空');
  }

  if (paymentStatus === undefined || paymentStatus === null) {
    return paramError('支付状态不能为空');
  }

  // 验证 paymentStatus 是否为有效值
  const validPaymentStatuses = Object.values(PAYMENT_STATUS);
  if (!validPaymentStatuses.includes(parseInt(paymentStatus))) {
    return paramError('无效的支付状态');
  }

  const targetPaymentStatus = parseInt(paymentStatus);

  // 查询订单
  const whereCondition = _.or([
    { _id: orderIdentifier },
    { orderNo: orderIdentifier }
  ]);

  const orderResult = await db.collection('orders').where(whereCondition).get();

  if (orderResult.data.length === 0) {
    return notFoundError('订单');
  }

  const order = orderResult.data[0];
  let currentOrderStatus = order.orderStatus !== undefined ? order.orderStatus : ORDER_FLOW_STATUS.CREATED;

  // 构建更新数据
  const updateData = {
    paymentStatus: targetPaymentStatus,
    updateTime: new Date()
  };

  // 如果是标记为已支付，添加支付相关信息
  if (targetPaymentStatus === PAYMENT_STATUS.PAID) {
    updateData.payTime = new Date();
    updateData.paymentMethod = paymentMethod || PAYMENT_METHOD.OFFLINE;
    if (paymentNote) {
      updateData.paymentNote = paymentNote;
    }
    updateData.paymentOperatorOpenid = OPENID;

    // 特殊处理：如果 orderStatus>=SERVICE_DONE 且 paymentStatus=PAID，自动推进 orderStatus 到 COMPLETED
    if (currentOrderStatus >= ORDER_FLOW_STATUS.SERVICE_DONE && currentOrderStatus !== ORDER_FLOW_STATUS.CANCELLED) {
      currentOrderStatus = ORDER_FLOW_STATUS.COMPLETED;
      updateData.orderStatus = ORDER_FLOW_STATUS.COMPLETED;
      updateData.completeTime = new Date();
      logger.info('Auto-advancing orderStatus to COMPLETED (service done + now paid)', { orderId: orderIdentifier });
    }
  }

  // 双写：根据新字段推导旧 status
  updateData.status = mapNewStatusToLegacy(currentOrderStatus, targetPaymentStatus);

  const updateResult = await db.collection('orders').where(whereCondition).update({
    data: updateData
  });

  if (updateResult.stats.updated === 0) {
    return error(ErrorCodes.DB_UPDATE_ERROR, '更新支付状态失败');
  }

  logger.info('Payment status updated', {
    orderId: orderIdentifier,
    newPaymentStatus: targetPaymentStatus,
    newOrderStatus: updateData.orderStatus || currentOrderStatus,
    newLegacyStatus: updateData.status
  });

  return success({
    paymentStatus: targetPaymentStatus,
    orderStatus: updateData.orderStatus || currentOrderStatus,
    status: updateData.status
  }, '支付状态更新成功');
}

/**
 * 批量迁移订单状态（数据回填）
 * 将现有订单的旧 status 字段映射到新的 orderStatus 和 paymentStatus 字段
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function migrateOrderStatus(data, context, logger) {
  const { OPENID } = cloud.getWXContext();

  // 仅管理员可执行此操作
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('仅管理员可执行此操作');
  }

  const { batchSize = 100, dryRun = false } = data;

  logger.info('Starting order status migration', { batchSize, dryRun });

  // 统计信息
  const stats = {
    total: 0,
    migrated: 0,
    failed: 0,
    details: {
      status0: { count: 0, label: 'PENDING -> CREATED + UNPAID' },
      status1: { count: 0, label: 'PAID -> CREATED + PAID' },
      status2_paid: { count: 0, label: 'PROCESSING + PAID' },
      status2_unpaid: { count: 0, label: 'PROCESSING + UNPAID' },
      status3: { count: 0, label: 'COMPLETED -> COMPLETED + PAID' },
      status4_paid: { count: 0, label: 'CANCELLED + PAID' },
      status4_unpaid: { count: 0, label: 'CANCELLED + UNPAID' },
      status5: { count: 0, label: 'SERVED_UNPAID -> SERVICE_DONE + UNPAID' }
    }
  };

  try {
    // 1. 查询所有没有 orderStatus 字段的订单总数
    const countResult = await db.collection('orders')
      .where({
        orderStatus: _.exists(false)
      })
      .count();

    stats.total = countResult.total;
    logger.info('Found orders to migrate', { total: stats.total });

    if (stats.total === 0) {
      return success({
        message: '没有需要迁移的订单',
        stats
      }, '迁移完成');
    }

    // 如果是 dryRun 模式，只统计不更新
    if (dryRun) {
      // 分批查询并统计各状态分布
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const ordersResult = await db.collection('orders')
          .where({
            orderStatus: _.exists(false)
          })
          .skip(offset)
          .limit(batchSize)
          .get();

        const orders = ordersResult.data;

        if (orders.length === 0) {
          hasMore = false;
          break;
        }

        // 统计各状态分布
        for (const order of orders) {
          const status = order.status;
          const hasPaidTime = !!order.payTime;

          switch (status) {
            case 0:
              stats.details.status0.count++;
              break;
            case 1:
              stats.details.status1.count++;
              break;
            case 2:
              if (hasPaidTime) {
                stats.details.status2_paid.count++;
              } else {
                stats.details.status2_unpaid.count++;
              }
              break;
            case 3:
              stats.details.status3.count++;
              break;
            case 4:
              if (hasPaidTime) {
                stats.details.status4_paid.count++;
              } else {
                stats.details.status4_unpaid.count++;
              }
              break;
            case 5:
              stats.details.status5.count++;
              break;
            default:
              break;
          }
        }

        offset += orders.length;
        if (orders.length < batchSize) {
          hasMore = false;
        }
      }

      logger.info('Dry run completed', { stats });

      return success({
        message: 'Dry run 完成，以下是迁移预览',
        dryRun: true,
        stats
      }, '迁移预览完成');
    }

    // 2. 分批处理订单
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const ordersResult = await db.collection('orders')
        .where({
          orderStatus: _.exists(false)
        })
        .skip(0) // 每次从头开始查，因为更新后的记录不会再被查到
        .limit(batchSize)
        .get();

      const orders = ordersResult.data;

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      logger.info('Processing batch', { batchNumber: Math.floor(offset / batchSize) + 1, count: orders.length });

      // 3. 对每条订单进行更新
      for (const order of orders) {
        try {
          const status = order.status;
          const payTime = order.payTime || null;

          // 调用映射函数获取新字段值
          const newFields = mapLegacyStatusToNew(status, payTime);

          // 更新订单
          await db.collection('orders').doc(order._id).update({
            data: {
              orderStatus: newFields.orderStatus,
              paymentStatus: newFields.paymentStatus,
              updateTime: new Date()
            }
          });

          stats.migrated++;

          // 统计详情
          const hasPaidTime = !!payTime;
          switch (status) {
            case 0:
              stats.details.status0.count++;
              break;
            case 1:
              stats.details.status1.count++;
              break;
            case 2:
              if (hasPaidTime) {
                stats.details.status2_paid.count++;
              } else {
                stats.details.status2_unpaid.count++;
              }
              break;
            case 3:
              stats.details.status3.count++;
              break;
            case 4:
              if (hasPaidTime) {
                stats.details.status4_paid.count++;
              } else {
                stats.details.status4_unpaid.count++;
              }
              break;
            case 5:
              stats.details.status5.count++;
              break;
            default:
              break;
          }

        } catch (err) {
          logger.error('Failed to migrate order', { orderId: order._id, error: err.message });
          stats.failed++;
        }
      }

      offset += orders.length;

      // 如果处理的数量少于 batchSize，说明已经处理完毕
      if (orders.length < batchSize) {
        hasMore = false;
      }
    }

    logger.info('Migration completed', { stats });

    return success({
      message: '迁移完成',
      stats
    }, '订单状态迁移成功');

  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    return error(ErrorCodes.DB_QUERY_ERROR, '迁移失败', { originalError: err.message });
  }
}

/**
 * 获取统计数据
 * @param {object} data - 请求数据
 * @param {object} context - 云函数上下文
 * @param {object} logger - 追踪日志记录器
 */
async function getStatistics(data, context, logger) {
  const { OPENID } = cloud.getWXContext();

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID);

  logger.info('Getting statistics', { isAdmin, openid: OPENID });

  if (!isAdmin) {
    return permissionError('仅管理员可查看统计数据');
  }

  try {
    const now = new Date();

    // 计算今日开始时间 (00:00:00)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 计算本周开始时间 (周一 00:00:00)
    const dayOfWeek = now.getDay() || 7; // 周日为0，转为7
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - dayOfWeek + 1);

    // 计算本月开始时间 (1号 00:00:00)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const legacyMissingCondition = _.or([
      { orderStatus: _.exists(false) },
      { paymentStatus: _.exists(false) },
      { orderStatus: null },
      { paymentStatus: null },
      { orderStatus: '' },
      { paymentStatus: '' }
    ]);

    // 并行查询各项统计数据
    const [
      todayOrdersResult,
      weekOrdersResult,
      monthOrdersResult,
      allOrdersResult,
      orderStatusResult,
      orderStatusGroupResult,
      paymentStatusGroupResult,
      orderStatusPaymentGroupResult,
      legacyMissingCountResult,
      productsResult,
      activeProductsResult
    ] = await Promise.all([
      // 今日订单统计
      db.collection('orders')
        .aggregate()
        .match({ createTime: _.gte(todayStart) })
        .group({
          _id: null,
          count: _.aggregate.sum(1),
          totalAmount: _.aggregate.sum('$totalAmount')
        })
        .end(),

      // 本周订单统计
      db.collection('orders')
        .aggregate()
        .match({ createTime: _.gte(weekStart) })
        .group({
          _id: null,
          count: _.aggregate.sum(1),
          totalAmount: _.aggregate.sum('$totalAmount')
        })
        .end(),

      // 本月订单统计
      db.collection('orders')
        .aggregate()
        .match({ createTime: _.gte(monthStart) })
        .group({
          _id: null,
          count: _.aggregate.sum(1),
          totalAmount: _.aggregate.sum('$totalAmount')
        })
        .end(),

      // 全部订单统计（只计入 paymentStatus=PAID 的订单）
      db.collection('orders')
        .aggregate()
        .match({
          paymentStatus: PAYMENT_STATUS.PAID
        })
        .group({
          _id: null,
          count: _.aggregate.sum(1),
          totalAmount: _.aggregate.sum('$totalAmount')
        })
        .end(),

      // 各状态订单数量（旧status）
      db.collection('orders')
        .aggregate()
        .group({
          _id: '$status',
          count: _.aggregate.sum(1)
        })
        .end(),

      // 按 orderStatus 分组统计
      db.collection('orders')
        .aggregate()
        .group({
          _id: '$orderStatus',
          count: _.aggregate.sum(1)
        })
        .end(),

      // 按 paymentStatus 分组统计
      db.collection('orders')
        .aggregate()
        .group({
          _id: '$paymentStatus',
          count: _.aggregate.sum(1)
        })
        .end(),

      // 按 orderStatus + paymentStatus 组合分组统计（新字段）
      db.collection('orders')
        .aggregate()
        .group({
          _id: {
            orderStatus: '$orderStatus',
            paymentStatus: '$paymentStatus'
          },
          count: _.aggregate.sum(1)
        })
        .end(),

      // 缺失新字段的订单数量（兼容）
      db.collection('orders')
        .where(legacyMissingCondition)
        .count(),

      // 商品总数
      db.collection('products').count(),

      // 上架商品数
      db.collection('products').where({ status: 1 }).count()
    ]);

    // 处理今日统计
    const todayStats = todayOrdersResult.list[0] || { count: 0, totalAmount: 0 };

    // 处理本周统计
    const weekStats = weekOrdersResult.list[0] || { count: 0, totalAmount: 0 };

    // 处理本月统计
    const monthStats = monthOrdersResult.list[0] || { count: 0, totalAmount: 0 };

    // 处理全部统计
    const allStats = allOrdersResult.list[0] || { count: 0, totalAmount: 0 };

    // 处理订单状态统计（旧status）
    const statusMap = {};
    orderStatusResult.list.forEach(item => {
      statusMap[item._id] = item.count;
    });

    // 处理 orderStatus 分组统计
    const orderStatusMap = {};
    if (orderStatusGroupResult && orderStatusGroupResult.list) {
      orderStatusGroupResult.list.forEach(item => {
        orderStatusMap[item._id] = item.count;
      });
    }

    // 处理 paymentStatus 分组统计
    const paymentStatusMap = {};
    if (paymentStatusGroupResult && paymentStatusGroupResult.list) {
      paymentStatusGroupResult.list.forEach(item => {
        paymentStatusMap[item._id] = item.count;
      });
    }

    const mainStatus = {
      pendingPayment: 0,
      waitService: 0,
      processing: 0,
      serviceDone: 0,
      completed: 0,
      cancelled: 0
    };

    const applyMainStatus = (orderStatus, paymentStatus, count = 1) => {
      if (orderStatus === undefined || orderStatus === null || orderStatus === '') {
        return;
      }
      const normalizedOrderStatus = Number(orderStatus);
      if (Number.isNaN(normalizedOrderStatus)) {
        return;
      }
      let normalizedPaymentStatus = paymentStatus;
      if (normalizedPaymentStatus === undefined || normalizedPaymentStatus === null || normalizedPaymentStatus === '') {
        normalizedPaymentStatus = PAYMENT_STATUS.UNPAID;
      }
      normalizedPaymentStatus = Number(normalizedPaymentStatus);
      if (Number.isNaN(normalizedPaymentStatus)) {
        normalizedPaymentStatus = PAYMENT_STATUS.UNPAID;
      }

      if (normalizedOrderStatus === ORDER_FLOW_STATUS.CREATED) {
        if (normalizedPaymentStatus === PAYMENT_STATUS.PAID) {
          mainStatus.waitService += count;
        } else {
          mainStatus.pendingPayment += count;
        }
        return;
      }

      if (normalizedOrderStatus === ORDER_FLOW_STATUS.PROCESSING) {
        mainStatus.processing += count;
        return;
      }

      if (normalizedOrderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) {
        if (normalizedPaymentStatus === PAYMENT_STATUS.PAID) {
          mainStatus.completed += count;
        } else {
          mainStatus.serviceDone += count;
        }
        return;
      }

      if (normalizedOrderStatus === ORDER_FLOW_STATUS.COMPLETED) {
        mainStatus.completed += count;
        return;
      }

      if (normalizedOrderStatus === ORDER_FLOW_STATUS.CANCELLED) {
        mainStatus.cancelled += count;
      }
    };

    if (orderStatusPaymentGroupResult && orderStatusPaymentGroupResult.list) {
      orderStatusPaymentGroupResult.list.forEach(item => {
        const orderStatus = item._id && item._id.orderStatus;
        const paymentStatus = item._id && item._id.paymentStatus;
        
        applyMainStatus(orderStatus, paymentStatus, item.count || 0);
      });
    }

    if (legacyMissingCountResult && legacyMissingCountResult.total > 0) {
      const legacyBatchSize = 200;
      let legacyOffset = 0;

      while (legacyOffset < legacyMissingCountResult.total) {
        const legacyResult = await db.collection('orders')
          .where(legacyMissingCondition)
          .field({ status: true, payTime: true })
          .skip(legacyOffset)
          .limit(legacyBatchSize)
          .get();

        const legacyOrders = legacyResult.data || [];
        if (legacyOrders.length === 0) {
          break;
        }

        legacyOrders.forEach(order => {
          const mapped = mapLegacyStatusToNew(order.status, order.payTime);
          applyMainStatus(mapped.orderStatus, mapped.paymentStatus, 1);
        });

        legacyOffset += legacyOrders.length;
      }
    }

    const statistics = {
      // 今日数据
      today: {
        orders: todayStats.count,
        sales: todayStats.totalAmount / 100 // 转换为元
      },
      // 本周数据
      week: {
        orders: weekStats.count,
        sales: weekStats.totalAmount / 100
      },
      // 本月数据
      month: {
        orders: monthStats.count,
        sales: monthStats.totalAmount / 100
      },
      // 全部数据
      total: {
        orders: allStats.count,
        sales: allStats.totalAmount / 100
      },
      // 订单状态分布（旧status字段）
      legacyStatus: {
        pending: statusMap[ORDER_STATUS.PENDING] || 0,      // 待支付
        paid: statusMap[ORDER_STATUS.PAID] || 0,            // 已支付
        processing: statusMap[ORDER_STATUS.PROCESSING] || 0, // 处理中
        completed: statusMap[ORDER_STATUS.COMPLETED] || 0,   // 已完成
        cancelled: statusMap[ORDER_STATUS.CANCELLED] || 0,   // 已取消
        servedUnpaid: statusMap[ORDER_STATUS.SERVED_UNPAID] || 0  // 已服务待付款
      },
      // 新订单流程状态分布（orderStatus字段）
      orderFlowStatus: {
        created: orderStatusMap[ORDER_FLOW_STATUS.CREATED] || 0,       // 已创建
        processing: orderStatusMap[ORDER_FLOW_STATUS.PROCESSING] || 0, // 服务中
        serviceDone: orderStatusMap[ORDER_FLOW_STATUS.SERVICE_DONE] || 0, // 服务完成
        completed: orderStatusMap[ORDER_FLOW_STATUS.COMPLETED] || 0,   // 已完成
        cancelled: orderStatusMap[ORDER_FLOW_STATUS.CANCELLED] || 0    // 已取消
      },
      // 支付状态分布（paymentStatus字段）
      paymentStatusDist: {
        unpaid: paymentStatusMap[PAYMENT_STATUS.UNPAID] || 0,  // 未支付
        paid: paymentStatusMap[PAYMENT_STATUS.PAID] || 0       // 已支付
      },
      // 展示用主状态分布（单一主状态）
      mainStatus: {
        pendingPayment: mainStatus.pendingPayment,
        waitService: mainStatus.waitService,
        processing: mainStatus.processing,
        serviceDone: mainStatus.serviceDone,
        completed: mainStatus.completed,
        cancelled: mainStatus.cancelled
      },
      // 商品统计
      products: {
        total: productsResult.total,
        active: activeProductsResult.total
      },
      // 统计时间
      statisticsTime: now
    };

    logger.info('Statistics retrieved successfully', {
      todayOrders: statistics.today.orders,
      totalOrders: statistics.total.orders
    });

    return success(statistics, '获取统计数据成功');
  } catch (err) {
    logger.error('Failed to get statistics', { error: err.message });
    return error(ErrorCodes.DB_QUERY_ERROR, '获取统计数据失败', { originalError: err.message });
  }
}

/**
 * 追加商品到订单（服务完成前 + 未付款）
 * 支持用户追加自己订单 / 管理员追加任意订单
 * @param {object} data - { orderNo, items: [{ productId, productName, price, quantity, productImage }], isAdmin? }
 */
async function appendOrderItems(data, context, logger) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, items, isAdmin } = data;

  logger.info('appendOrderItems called', { orderNo, itemCount: items?.length, isAdmin });

  if (!orderNo) return paramError('缺少订单号');
  if (!items || !Array.isArray(items) || items.length === 0) {
    return paramError('追加商品列表不能为空');
  }

  // 权限校验：管理员需要验证身份
  let hasAdminPrivilege = false;
  if (isAdmin) {
    hasAdminPrivilege = await verifyAdminByOpenid(OPENID);
    if (!hasAdminPrivilege) {
      return permissionError('无管理员权限');
    }
  }

  try {
    // 使用事务保证并发安全
    const transaction = await db.startTransaction();
    const ordersCollection = transaction.collection('orders');

    // 1. 查询订单
    const orderQuery = hasAdminPrivilege
      ? ordersCollection.where({ orderNo })
      : ordersCollection.where({ orderNo, userOpenid: OPENID });

    const orderResult = await orderQuery.get();
    if (!orderResult.data || orderResult.data.length === 0) {
      await transaction.rollback();
      return notFoundError('订单不存在或无权操作');
    }

    const order = orderResult.data[0];

    // 2. 状态校验：未付款 + 服务未完成
    const orderStatus = order.orderStatus !== undefined ? order.orderStatus : mapLegacyStatusToNew(order.status, order.payTime).orderStatus;
    const paymentStatus = order.paymentStatus !== undefined ? order.paymentStatus : mapLegacyStatusToNew(order.status, order.payTime).paymentStatus;

    if (paymentStatus !== PAYMENT_STATUS.UNPAID) {
      await transaction.rollback();
      return error(ErrorCodes.BUSINESS_ERROR, '订单已付款，无法追加商品');
    }
    if (orderStatus >= ORDER_FLOW_STATUS.SERVICE_DONE) {
      await transaction.rollback();
      return error(ErrorCodes.BUSINESS_ERROR, '服务已完成，无法追加商品');
    }

    // 3. 从数据库查询商品权威价格（安全：不信任客户端传来的价格）
    const productIds = items.map(item => item.productId);
    const productsResult = await db.collection('products')
      .where({ _id: db.command.in(productIds) })
      .get();

    const productMap = new Map();
    productsResult.data.forEach(p => {
      productMap.set(p._id, {
        price: p.price, // 数据库中已是分为单位
        name: p.name,
        imageUrl: p.imageUrl || p.image || ''
      });
    });

    // 验证所有商品都存在
    const missingProducts = productIds.filter(id => !productMap.has(id));
    if (missingProducts.length > 0) {
      await transaction.rollback();
      return error(ErrorCodes.BUSINESS_ERROR, `商品不存在: ${missingProducts.join(', ')}`);
    }

    // 4. 构建新商品列表（使用数据库权威价格）
    const existingItems = Array.isArray(order.items) ? order.items : [];
    const newItems = items.map(item => {
      const dbProduct = productMap.get(item.productId);
      const price = dbProduct.price; // 使用数据库价格（分）
      return {
        productId: item.productId,
        productName: dbProduct.name || item.productName || item.name,
        price: price,
        quantity: item.quantity,
        subtotal: price * item.quantity,
        productImage: dbProduct.imageUrl || item.productImage || '',
        appendedAt: new Date()
      };
    });

    // 合并追加商品：相同productId且都是追加商品的进行数量合并
    const mergeAppendedItems = (existingList, newList) => {
      const result = [...existingList];

      newList.forEach(newItem => {
        // 查找已存在的追加商品（有appendedAt标记）
        const existingIndex = result.findIndex(
          item => item.productId === newItem.productId && item.appendedAt
        );

        if (existingIndex > -1) {
          // 合并数量和小计
          result[existingIndex].quantity += newItem.quantity;
          result[existingIndex].subtotal += newItem.subtotal;
          // 保留最早的追加时间
          if (new Date(newItem.appendedAt) < new Date(result[existingIndex].appendedAt)) {
            result[existingIndex].appendedAt = newItem.appendedAt;
          }
        } else {
          // 新增追加商品
          result.push(newItem);
        }
      });

      return result;
    };

    const mergedItems = mergeAppendedItems(existingItems, newItems);

    // 4. 重算总金额
    const newTotalAmount = mergedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);

    // 5. 更新订单
    await ordersCollection.doc(order._id).update({
      data: {
        items: mergedItems,
        totalAmount: newTotalAmount,
        updateTime: new Date()
      }
    });

    await transaction.commit();

    logger.info('appendOrderItems success', {
      orderNo,
      addedCount: newItems.length,
      newTotalAmount: newTotalAmount / 100
    });

    return success({
      orderNo,
      items: mergedItems.map(i => ({ ...i, price: i.price / 100, subtotal: i.subtotal / 100 })),
      totalAmount: newTotalAmount / 100
    }, '商品追加成功');

  } catch (err) {
    logger.error('appendOrderItems failed', { error: err.message });
    return error(ErrorCodes.DB_UPDATE_ERROR, '追加商品失败', { originalError: err.message });
  }
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
    case 'submitOfflineSettlementIntent':
      return await submitOfflineSettlementIntent(data, context, logger);
    case 'updateOrderStatus':
      return await updateOrderStatus(data, context, logger);
    case 'bindOrder':
      return await bindOrder(data, context, logger);
    case 'deleteOrder':
      return await deleteOrder(data, context, logger);
    case 'getStatistics':
      return await getStatistics(data, context, logger);
    case 'markServiceCompleted':
      return await markServiceCompleted(data, context, logger);
    case 'recordOfflinePayment':
      return await recordOfflinePayment(data, context, logger);
    case 'updateOrderFlowStatus':
      return await updateOrderFlowStatus(data, context, logger);
    case 'updatePaymentStatus':
      return await updatePaymentStatus(data, context, logger);
    case 'migrateOrderStatus':
      return await migrateOrderStatus(data, context, logger);
    case 'appendOrderItems':
      return await appendOrderItems(data, context, logger);
    default:
      logger.warn('Unknown action', { action });
      return paramError(`不支持的操作类型: ${action}`);
  }
};

// 使用带追踪功能的包装器导出处理函数
// wrapHandlerWithTracing 会自动创建logger并传递给handler
exports.main = wrapHandlerWithTracing(handler, { functionName: 'orderManagement' });
