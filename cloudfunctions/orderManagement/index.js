// 订单管理云函数
// 支持订单创建、查询、状态更新等功能

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();

  // 记录请求日志
  console.log(`[${new Date().toISOString()}] 订单管理云函数调用:`, {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });

  try {
    let result;

    switch (action) {
      case 'createOrder':
        result = await createOrder(data, context);
        break;
      case 'getOrders':
        result = await getOrders(data, context);
        break;
      case 'getOrderDetail':
        result = await getOrderDetail(data, context);
        break;
      case 'updateOrderStatus':
        result = await updateOrderStatus(data, context);
        break;
      case 'bindOrder':
        result = await bindOrder(data, context);
        break;
      default:
        result = {
          code: 400,
          message: '不支持的操作类型'
        };
    }

    // 记录执行时间
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 订单管理云函数执行完成:`, {
      action,
      executionTime: `${executionTime}ms`,
      success: result.code === 200
    });

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 订单管理云函数执行错误:`, {
      action,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: error.message || '服务器内部错误',
      requestId: context.requestId
    };
  }
};

/**
 * 创建订单
 */
async function createOrder(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 开始创建订单:`, {
    openid: OPENID,
    itemCount: data.items?.length || 0,
    totalAmount: data.totalAmount
  });

  // 数据验证
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    console.warn('订单创建失败: 商品列表为空');
    return {
      code: 400,
      message: '订单商品不能为空'
    };
  }

  if (!data.totalAmount || data.totalAmount <= 0) {
    console.warn('订单创建失败: 订单金额无效', { totalAmount: data.totalAmount });
    return {
      code: 400,
      message: '订单金额必须大于0'
    };
  }
  
  // 生成订单号
  const orderNo = generateOrderNo();
  
  // 验证商品库存（这里简化处理，实际应该检查每个商品的库存）
  for (const item of data.items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return {
        code: 400,
        message: '商品信息不完整'
      };
    }
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
      subtotal: Math.round((item.price || 0) * item.quantity * 100)
    })),
    contactName: data.contactName || '',
    contactPhone: data.contactPhone || '',
    serviceTime: data.serviceTime || null,
    address: data.address || '',
    remark: data.remark || '',
    waitForBind: data.waitForBind || false, // 是否等待用户绑定
    createTime: new Date(),
    updateTime: new Date()
  };
  
  try {
    // 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });

    console.log(`订单数据保存成功: ${orderNo}`, { orderId: result._id });

    // 生成二维码URL
    const qrCodeUrl = await generateQRCode(orderNo);

    // 更新订单的二维码URL
    await db.collection('orders').doc(result._id).update({
      data: {
        qrCodeUrl,
        updateTime: new Date()
      }
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 订单创建成功:`, {
      orderNo,
      orderId: result._id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        orderNo,
        qrCodeUrl,
        totalAmount: orderData.totalAmount / 100 // 返回时转换为元
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 创建订单失败:`, {
      orderNo,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '创建订单失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 获取订单列表
 */
async function getOrders(data, context) {
  const { OPENID } = cloud.getWXContext();
  
  const {
    page = 1,
    size = 10,
    status,
    userId,
    isAdmin = false
  } = data;
  
  try {
    let query = db.collection('orders');
    
    // 构建查询条件
    const conditions = [];
    
    if (!isAdmin) {
      // 普通用户只能查看自己的订单
      conditions.push(_.or([
        { userOpenid: OPENID },
        { userId: userId }
      ]));
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
    
    // 格式化订单数据
    const orders = ordersResult.data.map(order => ({
      ...order,
      totalAmount: order.totalAmount / 100, // 转换为元
      items: order.items.map(item => ({
        ...item,
        price: item.price / 100,
        subtotal: item.subtotal / 100
      }))
    }));
    
    return {
      code: 200,
      message: '获取订单列表成功',
      data: {
        records: orders,
        total: countResult.total,
        page,
        size
      }
    };
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return {
      code: 500,
      message: '获取订单列表失败'
    };
  }
}

/**
 * 获取订单详情
 */
async function getOrderDetail(data, context) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, isAdmin = false } = data;
  
  if (!orderNo) {
    return {
      code: 400,
      message: '订单号不能为空'
    };
  }
  
  try {
    let query = db.collection('orders').where({ orderNo });
    
    if (!isAdmin) {
      // 普通用户只能查看自己的订单
      query = query.where({
        orderNo,
        userOpenid: OPENID
      });
    }
    
    const result = await query.get();
    
    if (result.data.length === 0) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = result.data[0];
    
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
    
    return {
      code: 200,
      message: '获取订单详情成功',
      data: formattedOrder
    };
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return {
      code: 500,
      message: '获取订单详情失败'
    };
  }
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(data, context) {
  const { orderNo, status, isAdmin = false } = data;
  
  if (!orderNo || status === undefined) {
    return {
      code: 400,
      message: '订单号和状态不能为空'
    };
  }
  
  // 验证状态值
  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(parseInt(status))) {
    return {
      code: 400,
      message: '无效的订单状态'
    };
  }
  
  if (!isAdmin) {
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }
  
  try {
    const result = await db.collection('orders')
      .where({ orderNo })
      .update({
        data: {
          status: parseInt(status),
          updateTime: new Date()
        }
      });
    
    if (result.stats.updated === 0) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    return {
      code: 200,
      message: '订单状态更新成功'
    };
  } catch (error) {
    console.error('更新订单状态失败:', error);
    return {
      code: 500,
      message: '更新订单状态失败'
    };
  }
}

/**
 * 绑定订单到用户
 */
async function bindOrder(data, context) {
  const { OPENID } = cloud.getWXContext();
  const { orderNo, userId } = data;
  
  if (!orderNo) {
    return {
      code: 400,
      message: '订单号不能为空'
    };
  }
  
  try {
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
      return {
        code: 404,
        message: '订单不存在或已绑定'
      };
    }
    
    return {
      code: 200,
      message: '订单绑定成功'
    };
  } catch (error) {
    console.error('绑定订单失败:', error);
    return {
      code: 500,
      message: '绑定订单失败'
    };
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
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `ORD${year}${month}${day}${hour}${minute}${second}${random}`;
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
      console.error('生成小程序码失败:', result);
      // 如果生成失败，返回默认的二维码URL
      return `cloud://miniprogram1-7g9dmu6h0a6c181c.6d69-miniprogram1-7g9dmu6h0a6c181c-1330048123/qrcodes/default.png`;
    }

    // 将生成的小程序码上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: `qrcodes/${orderNo}.png`,
      fileContent: result.buffer
    });

    if (uploadResult.fileID) {
      return uploadResult.fileID;
    } else {
      console.error('上传二维码到云存储失败:', uploadResult);
      return `cloud://miniprogram1-7g9dmu6h0a6c181c.6d69-miniprogram1-7g9dmu6h0a6c181c-1330048123/qrcodes/default.png`;
    }
  } catch (error) {
    console.error('生成二维码失败:', error);
    // 返回默认的二维码URL
    return `cloud://miniprogram1-7g9dmu6h0a6c181c.6d69-miniprogram1-7g9dmu6h0a6c181c-1330048123/qrcodes/default.png`;
  }
}
