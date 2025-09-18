// 商品管理云函数
// 支持商品查询、创建、更新、删除等功能

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();
  
  // 记录请求日志
  console.log(`[${new Date().toISOString()}] 商品管理云函数调用:`, {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });
  
  try {
    let result;
    
    switch (action) {
      case 'getProducts':
        result = await getProducts(data, context);
        break;
      case 'getProductDetail':
        result = await getProductDetail(data, context);
        break;
      case 'createProduct':
        result = await createProduct(data, context);
        break;
      case 'updateProduct':
        result = await updateProduct(data, context);
        break;
      case 'deleteProduct':
        result = await deleteProduct(data, context);
        break;
      case 'updateStock':
        result = await updateStock(data, context);
        break;
      default:
        result = {
          code: 400,
          message: '不支持的操作类型'
        };
    }
    
    // 记录执行时间
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品管理云函数执行完成:`, {
      action,
      executionTime: `${executionTime}ms`,
      success: result.code === 200
    });
    
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 商品管理云函数执行错误:`, {
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
 * 获取商品列表
 */
async function getProducts(data, context) {
  const startTime = Date.now();
  const { page = 1, size = 10, category, keyword, status, orderBy = 'createTime', orderDirection = 'desc' } = data;
  
  console.log(`[${new Date().toISOString()}] 开始获取商品列表:`, {
    page, size, category, keyword, status, orderBy, orderDirection
  });
  
  try {
    // 构建查询条件
    let query = db.collection('products');
    const conditions = [];
    
    // 分类筛选
    if (category !== undefined && category !== '') {
      conditions.push({ category: parseInt(category) });
    }
    
    // 关键词搜索
    if (keyword) {
      conditions.push({
        name: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      });
    }
    
    // 状态筛选
    if (status !== undefined && status !== '') {
      conditions.push({ status: parseInt(status) });
    }
    
    // 应用查询条件
    if (conditions.length > 0) {
      query = query.where(_.and(conditions));
    }
    
    // 排序
    const orderField = orderBy || 'createTime';
    const direction = orderDirection === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(orderField, direction);
    
    // 分页
    const skip = (page - 1) * size;
    query = query.skip(skip).limit(size);
    
    // 执行查询
    const result = await query.get();
    
    // 获取总数
    let countQuery = db.collection('products');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }
    const countResult = await countQuery.count();
    
    // 格式化商品数据
    const products = result.data.map(product => ({
      ...product,
      price: product.price / 100, // 转换为元
      displayPrice: (product.price / 100).toFixed(2)
    }));
    
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品列表获取成功:`, {
      count: products.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });
    
    return {
      code: 200,
      message: '获取商品列表成功',
      data: {
        records: products,
        total: countResult.total,
        page: parseInt(page),
        size: parseInt(size),
        hasMore: products.length === size
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 获取商品列表失败:`, {
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });
    
    return {
      code: 500,
      message: '获取商品列表失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 获取商品详情
 */
async function getProductDetail(data, context) {
  const startTime = Date.now();
  const { id } = data;
  
  console.log(`[${new Date().toISOString()}] 开始获取商品详情:`, { productId: id });
  
  if (!id) {
    console.warn('获取商品详情失败: 商品ID为空');
    return {
      code: 400,
      message: '商品ID不能为空'
    };
  }
  
  try {
    // 查询商品详情
    const result = await db.collection('products').doc(id).get();
    
    if (!result.data) {
      console.warn('商品不存在:', { productId: id });
      return {
        code: 404,
        message: '商品不存在'
      };
    }
    
    // 处理价格显示（从分转换为元）
    const product = {
      ...result.data,
      price: result.data.price / 100, // 转换为元
      displayPrice: (result.data.price / 100).toFixed(2)
    };
    
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品详情获取成功:`, {
      productId: id,
      productName: product.name,
      executionTime: `${executionTime}ms`
    });
    
    return {
      code: 200,
      message: '获取商品详情成功',
      data: product
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 获取商品详情失败:`, {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });
    
    return {
      code: 500,
      message: '获取商品详情失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 创建商品
 */
async function createProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 开始创建商品:`, {
    openid: OPENID,
    productName: data.name
  });

  // 数据验证
  if (!data.name || !data.price) {
    console.warn('创建商品失败: 必填字段缺失');
    return {
      code: 400,
      message: '商品名称和价格不能为空'
    };
  }

  if (data.price <= 0) {
    console.warn('创建商品失败: 价格无效', { price: data.price });
    return {
      code: 400,
      message: '商品价格必须大于0'
    };
  }

  try {
    // 构建商品数据
    const product = {
      ...data,
      price: Math.round(data.price * 100), // 转换为分
      createTime: new Date(),
      updateTime: new Date(),
      status: data.status || 1,
      creatorOpenid: OPENID
    };

    // 保存到数据库
    const result = await db.collection('products').add({
      data: product
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品创建成功:`, {
      productId: result._id,
      productName: data.name,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '创建商品成功',
      data: {
        _id: result._id,
        ...product,
        price: product.price / 100 // 返回时转换为元
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 创建商品失败:`, {
      productName: data.name,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '创建商品失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 更新商品
 */
async function updateProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, ...updateData } = data;

  console.log(`[${new Date().toISOString()}] 开始更新商品:`, {
    openid: OPENID,
    productId: id
  });

  if (!id) {
    console.warn('更新商品失败: 商品ID为空');
    return {
      code: 400,
      message: '商品ID不能为空'
    };
  }

  try {
    // 构建更新数据
    const updateFields = {
      ...updateData,
      updateTime: new Date(),
      updaterOpenid: OPENID
    };

    // 如果包含价格，转换为分
    if (updateData.price !== undefined) {
      updateFields.price = Math.round(updateData.price * 100);
    }

    // 更新商品
    await db.collection('products').doc(id).update({
      data: updateFields
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品更新成功:`, {
      productId: id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '更新商品成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 更新商品失败:`, {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '更新商品失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 删除商品
 */
async function deleteProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id } = data;

  console.log(`[${new Date().toISOString()}] 开始删除商品:`, {
    openid: OPENID,
    productId: id
  });

  if (!id) {
    console.warn('删除商品失败: 商品ID为空');
    return {
      code: 400,
      message: '商品ID不能为空'
    };
  }

  try {
    // 删除商品
    await db.collection('products').doc(id).remove();

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 商品删除成功:`, {
      productId: id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '删除商品成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 删除商品失败:`, {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '删除商品失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 更新库存
 */
async function updateStock(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, stock } = data;

  console.log(`[${new Date().toISOString()}] 开始更新库存:`, {
    openid: OPENID,
    productId: id,
    newStock: stock
  });

  if (!id) {
    console.warn('更新库存失败: 商品ID为空');
    return {
      code: 400,
      message: '商品ID不能为空'
    };
  }

  if (stock === undefined || stock < 0) {
    console.warn('更新库存失败: 库存数量无效', { stock });
    return {
      code: 400,
      message: '库存数量不能为空且不能小于0'
    };
  }

  try {
    // 更新库存
    await db.collection('products').doc(id).update({
      data: {
        stock: parseInt(stock),
        updateTime: new Date(),
        updaterOpenid: OPENID
      }
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 库存更新成功:`, {
      productId: id,
      newStock: stock,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '更新库存成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 更新库存失败:`, {
      productId: id,
      newStock: stock,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '更新库存失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}
