// 套餐管理云函数
// 支持套餐查询、创建、更新、删除等功能

const cloud = require('wx-server-sdk');
const { ErrorCodes, success, error, paramError, permissionError, notFoundError, dbError, wrapHandler } = require('./_shared/errorHandler');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 将旧格式模板转换为新格式
 * 新格式: template[].products[] 包含多个商品
 * 旧格式: template[].defaultProductId 只有一个默认商品
 * @param {Array} template - 模板数据
 * @returns {Array} 标准化后的模板数据
 */
function normalizeTemplate(template) {
  if (!template || !Array.isArray(template)) return [];
  
  return template.map(item => {
    // 新格式：已有 products 数组
    if (item.products && Array.isArray(item.products)) {
      return item;
    }
    
    // 旧格式：转换为新格式
    const products = [];
    if (item.defaultProductId) {
      products.push({
        productId: item.defaultProductId,
        productName: item.defaultProductName || '',
        price: 0,
        quantity: item.quantity || 1,
        imageUrl: ''
      });
    }
    
    return {
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      products: products
    };
  });
}

/**
 * 计算套餐总价（基于模板中的商品）
 * @param {Array} template - 模板数据
 * @returns {number} 总价（单位：分）
 */
function calculatePackagePrice(template) {
  if (!template || !Array.isArray(template)) return 0;
  
  return template.reduce((total, category) => {
    if (!category.products || !Array.isArray(category.products)) return total;
    
    const categoryTotal = category.products.reduce((sum, product) => {
      return sum + ((product.price || 0) * (product.quantity || 1));
    }, 0);
    
    return total + categoryTotal;
  }, 0);
}

/**
 * 验证模板数据格式
 * @param {Array} template - 模板数据
 * @returns {Object} { valid: boolean, error: string }
 */
function validateTemplate(template) {
  if (!template) {
    return { valid: true, error: null };
  }
  
  if (!Array.isArray(template)) {
    return { valid: false, error: 'Template must be an array' };
  }
  
  for (let i = 0; i < template.length; i++) {
    const category = template[i];
    
    if (!category.categoryId) {
      return { valid: false, error: `Category at index ${i} missing categoryId` };
    }
    
    if (!category.categoryName) {
      return { valid: false, error: `Category at index ${i} missing categoryName` };
    }
    
    if (category.products && !Array.isArray(category.products)) {
      return { valid: false, error: `Category ${category.categoryName} products must be an array` };
    }
    
    if (category.products) {
      for (let j = 0; j < category.products.length; j++) {
        const product = category.products[j];
        
        if (!product.productId) {
          return { valid: false, error: `Product at index ${j} in category ${category.categoryName} missing productId` };
        }
        
        if (product.price !== undefined && (typeof product.price !== 'number' || product.price < 0)) {
          return { valid: false, error: `Product ${product.productName || product.productId} has invalid price` };
        }
        
        if (product.quantity !== undefined && (typeof product.quantity !== 'number' || product.quantity < 1)) {
          return { valid: false, error: `Product ${product.productName || product.productId} has invalid quantity` };
        }
      }
    }
  }
  
  return { valid: true, error: null };
}

/**
 * 云函数主处理逻辑
 */
const handler = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();
  
  // 记录请求日志
  console.log('[PACKAGE_MANAGEMENT] Request received:', {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });
  
  let result;
  
  switch (action) {
    case 'getPackages':
      result = await getPackages(data, context);
      break;
    case 'getPackageDetail':
      result = await getPackageDetail(data, context);
      break;
    case 'createPackage':
      result = await createPackage(data, context);
      break;
    case 'updatePackage':
      result = await updatePackage(data, context);
      break;
    case 'deletePackage':
      result = await deletePackage(data, context);
      break;
    case 'updatePackageStatus':
      result = await updatePackageStatus(data, context);
      break;
    default:
      result = paramError('action', 'Unsupported action type');
  }
  
  // 记录执行时间
  const executionTime = Date.now() - startTime;
  console.log('[PACKAGE_MANAGEMENT] Request completed:', {
    action,
    executionTime: `${executionTime}ms`,
    success: result.code === 0 || result.code === 200
  });
  
  return result;
};

/**
 * 获取套餐列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.type - 套餐类型 (white/red)
 * @param {string} data.keyword - 搜索关键词
 * @param {number} data.status - 状态筛选
 * @param {boolean} data.isAdmin - 是否管理员请求
 */
async function getPackages(data, context) {
  const startTime = Date.now();
  const { 
    page = 1, 
    size = 10, 
    type, 
    keyword, 
    status, 
    isAdmin = false,
    orderBy = 'sort',
    orderDirection = 'asc'
  } = data || {};
  
  console.log('[PACKAGE_MANAGEMENT] getPackages:', {
    page, size, type, keyword, status, isAdmin, orderBy, orderDirection
  });
  
  try {
    // 构建查询条件
    let query = db.collection('packages');
    const conditions = [];
    
    // 类型筛选
    if (type !== undefined && type !== '') {
      conditions.push({ type: type });
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
    // 非管理员只能看到上线的套餐
    if (!isAdmin) {
      conditions.push({ status: 1 });
    } else if (status !== undefined && status !== '') {
      conditions.push({ status: parseInt(status) });
    }
    
    // 应用查询条件
    if (conditions.length > 0) {
      query = query.where(_.and(conditions));
    }
    
    // 排序
    const orderField = orderBy || 'sort';
    const direction = orderDirection === 'desc' ? 'desc' : 'asc';
    query = query.orderBy(orderField, direction);
    
    // 如果按sort排序，再按createTime倒序
    if (orderField === 'sort') {
      query = query.orderBy('createTime', 'desc');
    }
    
    // 分页
    const skip = (page - 1) * size;
    query = query.skip(skip).limit(size);
    
    // 执行查询
    const result = await query.get();
    
    // 获取总数
    let countQuery = db.collection('packages');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }
    const countResult = await countQuery.count();
    
    // 格式化套餐数据
    const packages = result.data.map(pkg => ({
      ...pkg,
      price: pkg.price / 100, // 转换为元
      discountPrice: pkg.discountPrice ? pkg.discountPrice / 100 : null,
      displayPrice: (pkg.price / 100).toFixed(2),
      displayDiscountPrice: pkg.discountPrice ? (pkg.discountPrice / 100).toFixed(2) : null,
      template: normalizeTemplate(pkg.template) // 标准化模板格式
    }));
    
    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] getPackages success:', {
      count: packages.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });
    
    return success({
      records: packages,
      total: countResult.total,
      page: parseInt(page),
      size: parseInt(size),
      hasMore: packages.length === size
    }, 'Get package list success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] getPackages failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });
    
    return dbError('Failed to get package list', { originalError: err.message });
  }
}

/**
 * 获取套餐详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 套餐ID
 * @param {boolean} data.isAdmin - 是否管理员请求
 */
async function getPackageDetail(data, context) {
  const startTime = Date.now();
  const { id, isAdmin = false } = data || {};
  
  console.log('[PACKAGE_MANAGEMENT] getPackageDetail:', { packageId: id, isAdmin });
  
  if (!id) {
    console.warn('[PACKAGE_MANAGEMENT] getPackageDetail failed: Missing package ID');
    return paramError('id', 'Package ID is required');
  }
  
  try {
    // 查询套餐详情
    const result = await db.collection('packages').doc(id).get();
    
    if (!result.data) {
      console.warn('[PACKAGE_MANAGEMENT] Package not found:', { packageId: id });
      return notFoundError('Package');
    }
    
    const pkg = result.data;
    
    // 非管理员不能查看下线的套餐
    if (!isAdmin && pkg.status !== 1) {
      console.warn('[PACKAGE_MANAGEMENT] Package is offline:', { packageId: id });
      return notFoundError('Package');
    }
    
    // 标准化模板格式
    const normalizedTemplate = normalizeTemplate(pkg.template);
    
    // 获取模板中的商品详情
    let templateWithProducts = [];
    if (normalizedTemplate && normalizedTemplate.length > 0) {
      // 收集所有商品ID
      const productIds = [];
      normalizedTemplate.forEach(category => {
        if (category.products && Array.isArray(category.products)) {
          category.products.forEach(product => {
            if (product.productId && !productIds.includes(product.productId)) {
              productIds.push(product.productId);
            }
          });
        }
      });
      
      if (productIds.length > 0) {
        // 批量查询商品
        const productsResult = await db.collection('products')
          .where({
            _id: _.in(productIds)
          })
          .get();
        
        const productsMap = {};
        productsResult.data.forEach(product => {
          productsMap[product._id] = {
            ...product,
            price: product.price / 100,
            displayPrice: (product.price / 100).toFixed(2)
          };
        });
        
        // 组装模板数据，为每个商品补充详细信息
        templateWithProducts = normalizedTemplate.map(category => ({
          ...category,
          products: (category.products || []).map(product => ({
            ...product,
            productDetail: productsMap[product.productId] || null,
            // 价格转换为元显示
            displayPrice: product.price ? (product.price / 100).toFixed(2) : '0.00'
          }))
        }));
      } else {
        templateWithProducts = normalizedTemplate;
      }
    }
    
    // 处理价格显示（从分转换为元）
    const packageDetail = {
      ...pkg,
      price: pkg.price / 100,
      discountPrice: pkg.discountPrice ? pkg.discountPrice / 100 : null,
      displayPrice: (pkg.price / 100).toFixed(2),
      displayDiscountPrice: pkg.discountPrice ? (pkg.discountPrice / 100).toFixed(2) : null,
      template: templateWithProducts
    };
    
    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] getPackageDetail success:', {
      packageId: id,
      packageName: packageDetail.name,
      templateCount: templateWithProducts.length,
      executionTime: `${executionTime}ms`
    });
    
    return success(packageDetail, 'Get package detail success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] getPackageDetail failed:', {
      packageId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });
    
    return dbError('Failed to get package detail', { originalError: err.message });
  }
}

/**
 * 创建套餐
 * @param {Object} data - 套餐数据
 */
async function createPackage(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log('[PACKAGE_MANAGEMENT] createPackage:', {
    openid: OPENID,
    packageName: data?.name,
    isAdmin: data?.isAdmin
  });

  // 权限检查 - 只有管理员可以创建套餐
  if (!data?.isAdmin) {
    console.warn('[PACKAGE_MANAGEMENT] createPackage failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can create package');
  }

  // 数据验证
  if (!data?.name) {
    console.warn('[PACKAGE_MANAGEMENT] createPackage failed: Missing package name');
    return paramError('name', 'Package name is required');
  }

  if (!data?.price || data.price <= 0) {
    console.warn('[PACKAGE_MANAGEMENT] createPackage failed: Invalid price', { price: data?.price });
    return paramError('price', 'Package price must be greater than 0');
  }

  // type字段默认为'white'，不再强制验证
  const packageType = data?.type || 'white';

  // 验证模板数据格式
  if (data?.template) {
    const templateValidation = validateTemplate(data.template);
    if (!templateValidation.valid) {
      console.warn('[PACKAGE_MANAGEMENT] createPackage failed: Invalid template', { error: templateValidation.error });
      return paramError('template', templateValidation.error);
    }
  }

  try {
    // 标准化模板数据
    const normalizedTemplate = normalizeTemplate(data.template || []);
    
    // 构建套餐数据
    const packageData = {
      name: data.name,
      description: data.description || '',
      type: packageType, // 默认为'white'
      price: Math.round(data.price * 100), // 转换为分
      discountPrice: data.discountPrice ? Math.round(data.discountPrice * 100) : null,
      imageUrl: data.imageUrl || '',
      status: data.status !== undefined ? data.status : 1,
      sort: data.sort || 0,
      template: normalizedTemplate,
      createTime: new Date(),
      updateTime: new Date(),
      creatorOpenid: OPENID
    };

    // 保存到数据库
    const result = await db.collection('packages').add({
      data: packageData
    });

    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] createPackage success:', {
      packageId: result._id,
      packageName: data.name,
      executionTime: `${executionTime}ms`
    });

    return success({
      _id: result._id,
      ...packageData,
      price: packageData.price / 100, // 返回时转换为元
      discountPrice: packageData.discountPrice ? packageData.discountPrice / 100 : null
    }, 'Create package success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] createPackage failed:', {
      packageName: data?.name,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to create package', { originalError: err.message });
  }
}

/**
 * 更新套餐
 * @param {Object} data - 套餐数据
 */
async function updatePackage(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin, ...updateData } = data || {};

  console.log('[PACKAGE_MANAGEMENT] updatePackage:', {
    openid: OPENID,
    packageId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新套餐
  if (!isAdmin) {
    console.warn('[PACKAGE_MANAGEMENT] updatePackage failed: No admin permission', { openid: OPENID, packageId: id });
    return permissionError('Only admin can update package');
  }

  if (!id) {
    console.warn('[PACKAGE_MANAGEMENT] updatePackage failed: Missing package ID');
    return paramError('id', 'Package ID is required');
  }

  // 验证模板数据格式
  if (updateData.template !== undefined) {
    const templateValidation = validateTemplate(updateData.template);
    if (!templateValidation.valid) {
      console.warn('[PACKAGE_MANAGEMENT] updatePackage failed: Invalid template', { error: templateValidation.error });
      return paramError('template', templateValidation.error);
    }
  }

  try {
    // 构建更新数据
    const updateFields = {
      updateTime: new Date(),
      updaterOpenid: OPENID
    };

    // 处理各字段
    if (updateData.name !== undefined) {
      updateFields.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      updateFields.description = updateData.description;
    }
    if (updateData.type !== undefined) {
      // 保留type字段更新能力，但不再强制验证
      updateFields.type = updateData.type || 'white';
    }
    if (updateData.price !== undefined) {
      updateFields.price = Math.round(updateData.price * 100);
    }
    if (updateData.discountPrice !== undefined) {
      updateFields.discountPrice = updateData.discountPrice ? Math.round(updateData.discountPrice * 100) : null;
    }
    if (updateData.imageUrl !== undefined) {
      updateFields.imageUrl = updateData.imageUrl;
    }
    if (updateData.status !== undefined) {
      updateFields.status = parseInt(updateData.status);
    }
    if (updateData.sort !== undefined) {
      updateFields.sort = parseInt(updateData.sort);
    }
    if (updateData.template !== undefined) {
      // 标准化模板数据
      updateFields.template = normalizeTemplate(updateData.template);
    }

    // 更新套餐
    await db.collection('packages').doc(id).update({
      data: updateFields
    });

    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] updatePackage success:', {
      packageId: id,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Update package success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] updatePackage failed:', {
      packageId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update package', { originalError: err.message });
  }
}

/**
 * 删除套餐
 * @param {Object} data - 参数
 * @param {string} data.id - 套餐ID
 */
async function deletePackage(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin } = data || {};

  console.log('[PACKAGE_MANAGEMENT] deletePackage:', {
    openid: OPENID,
    packageId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以删除套餐
  if (!isAdmin) {
    console.warn('[PACKAGE_MANAGEMENT] deletePackage failed: No admin permission', { openid: OPENID, packageId: id });
    return permissionError('Only admin can delete package');
  }

  if (!id) {
    console.warn('[PACKAGE_MANAGEMENT] deletePackage failed: Missing package ID');
    return paramError('id', 'Package ID is required');
  }

  try {
    // 删除套餐
    await db.collection('packages').doc(id).remove();

    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] deletePackage success:', {
      packageId: id,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Delete package success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] deletePackage failed:', {
      packageId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to delete package', { originalError: err.message });
  }
}

/**
 * 更新套餐状态
 * @param {Object} data - 参数
 * @param {string} data.id - 套餐ID
 * @param {number} data.status - 新状态 (0=下线, 1=上线)
 */
async function updatePackageStatus(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, status, isAdmin } = data || {};

  console.log('[PACKAGE_MANAGEMENT] updatePackageStatus:', {
    openid: OPENID,
    packageId: id,
    newStatus: status,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新状态
  if (!isAdmin) {
    console.warn('[PACKAGE_MANAGEMENT] updatePackageStatus failed: No admin permission', { openid: OPENID, packageId: id });
    return permissionError('Only admin can update package status');
  }

  if (!id) {
    console.warn('[PACKAGE_MANAGEMENT] updatePackageStatus failed: Missing package ID');
    return paramError('id', 'Package ID is required');
  }

  if (status === undefined || ![0, 1].includes(parseInt(status))) {
    console.warn('[PACKAGE_MANAGEMENT] updatePackageStatus failed: Invalid status', { status });
    return paramError('status', 'Status must be 0 or 1');
  }

  try {
    // 更新状态
    await db.collection('packages').doc(id).update({
      data: {
        status: parseInt(status),
        updateTime: new Date(),
        updaterOpenid: OPENID
      }
    });

    const executionTime = Date.now() - startTime;
    console.log('[PACKAGE_MANAGEMENT] updatePackageStatus success:', {
      packageId: id,
      newStatus: status,
      executionTime: `${executionTime}ms`
    });

    return success(null, 'Update package status success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PACKAGE_MANAGEMENT] updatePackageStatus failed:', {
      packageId: id,
      newStatus: status,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update package status', { originalError: err.message });
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'packageManagement' });