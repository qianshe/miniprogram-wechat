// 商品管理云函数
// 支持商品查询、创建、更新、删除等功能

const cloud = require('wx-server-sdk');
const { ErrorCodes, success, error, paramError, permissionError, notFoundError, dbError, wrapHandler } = require('./_shared/errorHandler');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数主处理逻辑
 */
const handler = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();
  
  // 记录请求日志
  console.log('[PRODUCT_MANAGEMENT] Request received:', {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });
  
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
      result = paramError('action', 'Unsupported action type');
  }
  
  // 记录执行时间
  const executionTime = Date.now() - startTime;
  console.log('[PRODUCT_MANAGEMENT] Request completed:', {
    action,
    executionTime: `${executionTime}ms`,
    success: result.code === 0
  });
  
  return result;
};

/**
 * 获取商品列表
 */
async function getProducts(data, context) {
  const startTime = Date.now();
  const { page = 1, size = 10, category, keyword, status, orderBy = 'createTime', orderDirection = 'desc' } = data || {};
  
  console.log('[PRODUCT_MANAGEMENT] getProducts:', {
    page, size, category, keyword, status, orderBy, orderDirection
  });
  
  try {
    // 构建查询条件
    let query = db.collection('products');
    const conditions = [];
    
    // 分类筛选 - category现在是分类_id字符串
    if (category !== undefined && category !== '') {
      conditions.push({ category: category });
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
    console.log('[PRODUCT_MANAGEMENT] getProducts success:', {
      count: products.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });
    
    return success({
      records: products,
      total: countResult.total,
      page: parseInt(page),
      size: parseInt(size),
      hasMore: products.length === size
    }, 'Get product list success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] getProducts failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });
    
    return dbError('Failed to get product list', { originalError: err.message });
  }
}

/**
 * 获取商品详情
 */
async function getProductDetail(data, context) {
  const startTime = Date.now();
  const { id } = data || {};
  
  console.log('[PRODUCT_MANAGEMENT] getProductDetail:', { productId: id });
  
  if (!id) {
    console.warn('[PRODUCT_MANAGEMENT] getProductDetail failed: Missing product ID');
    return paramError('id', 'Product ID is required');
  }
  
  try {
    // 查询商品详情
    const result = await db.collection('products').doc(id).get();
    
    if (!result.data) {
      console.warn('[PRODUCT_MANAGEMENT] Product not found:', { productId: id });
      return notFoundError('Product');
    }
    
    // 处理价格显示（从分转换为元）
    const product = {
      ...result.data,
      price: result.data.price / 100, // 转换为元
      displayPrice: (result.data.price / 100).toFixed(2)
    };
    
    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] getProductDetail success:', {
      productId: id,
      productName: product.name,
      executionTime: `${executionTime}ms`
    });
    
    return success(product, 'Get product detail success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] getProductDetail failed:', {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });
    
    return dbError('Failed to get product detail', { originalError: err.message });
  }
}

/**
 * 创建商品
 */
async function createProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log('[PRODUCT_MANAGEMENT] createProduct:', {
    openid: OPENID,
    productName: data?.name,
    isAdmin: data?.isAdmin
  });

  // 权限检查 - 只有管理员可以创建商品
  if (!data?.isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can create product');
  }

  // 数据验证
  if (!data?.name || !data?.price) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: Missing required fields');
    return paramError('name/price', 'Product name and price are required');
  }

  if (data.price <= 0) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: Invalid price', { price: data.price });
    return paramError('price', 'Product price must be greater than 0');
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
    console.log('[PRODUCT_MANAGEMENT] createProduct success:', {
      productId: result._id,
      productName: data.name,
      executionTime: `${executionTime}ms`
    });

    return success({
      _id: result._id,
      ...product,
      price: product.price / 100 // 返回时转换为元
    }, 'Create product success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] createProduct failed:', {
      productName: data?.name,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to create product', { originalError: err.message });
  }
}

/**
 * 更新商品
 */
async function updateProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin, ...updateData } = data || {};

  console.log('[PRODUCT_MANAGEMENT] updateProduct:', {
    openid: OPENID,
    productId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新商品
  if (!isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] updateProduct failed: No admin permission', { openid: OPENID, productId: id });
    return permissionError('Only admin can update product');
  }

  if (!id) {
    console.warn('[PRODUCT_MANAGEMENT] updateProduct failed: Missing product ID');
    return paramError('id', 'Product ID is required');
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
    console.log('[PRODUCT_MANAGEMENT] updateProduct success:', {
      productId: id,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Update product success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] updateProduct failed:', {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update product', { originalError: err.message });
  }
}

/**
 * 删除商品
 */
async function deleteProduct(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin } = data || {};

  console.log('[PRODUCT_MANAGEMENT] deleteProduct:', {
    openid: OPENID,
    productId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以删除商品
  if (!isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] deleteProduct failed: No admin permission', { openid: OPENID, productId: id });
    return permissionError('Only admin can delete product');
  }

  if (!id) {
    console.warn('[PRODUCT_MANAGEMENT] deleteProduct failed: Missing product ID');
    return paramError('id', 'Product ID is required');
  }

  try {
    // 删除商品
    await db.collection('products').doc(id).remove();

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] deleteProduct success:', {
      productId: id,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Delete product success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] deleteProduct failed:', {
      productId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to delete product', { originalError: err.message });
  }
}

/**
 * 更新库存
 */
async function updateStock(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, stock, isAdmin } = data || {};

  console.log('[PRODUCT_MANAGEMENT] updateStock:', {
    openid: OPENID,
    productId: id,
    newStock: stock,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新库存
  if (!isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] updateStock failed: No admin permission', { openid: OPENID, productId: id });
    return permissionError('Only admin can update stock');
  }

  if (!id) {
    console.warn('[PRODUCT_MANAGEMENT] updateStock failed: Missing product ID');
    return paramError('id', 'Product ID is required');
  }

  if (stock === undefined || stock < 0) {
    console.warn('[PRODUCT_MANAGEMENT] updateStock failed: Invalid stock quantity', { stock });
    return paramError('stock', 'Stock quantity is required and must be >= 0');
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
    console.log('[PRODUCT_MANAGEMENT] updateStock success:', {
      productId: id,
      newStock: stock,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Update stock success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] updateStock failed:', {
      productId: id,
      newStock: stock,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update stock', { originalError: err.message });
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'productManagement' });
