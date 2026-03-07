// 商品管理云函数
// 支持商品查询、创建、更新、删除等功能

const cloud = require('wx-server-sdk');
const { ErrorCodes, success, error, paramError, permissionError, notFoundError, dbError, wrapHandler } = require('./_shared/errorHandler');
const { checkSensitiveWords } = require('./_shared/sensitiveWords');
const { verifyAdminByOpenid: _verifyAdmin } = require('./_shared/permission');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const verifyAdminByOpenid = (openid) => _verifyAdmin(openid, db);

function getProvidedCostPrice(data = {}) {
  if (data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== '') {
    return data.costPrice
  }

  if (data.originalPrice !== undefined && data.originalPrice !== null && data.originalPrice !== '') {
    return data.originalPrice
  }

  return undefined
}

function getStoredCostPrice(product = {}) {
  if (product.costPrice !== undefined && product.costPrice !== null && product.costPrice !== '') {
    return product.costPrice
  }

  if (product.originalPrice !== undefined && product.originalPrice !== null && product.originalPrice !== '') {
    return product.originalPrice
  }

  return undefined
}

function normalizeProductOutput(product = {}) {
  const normalized = {
    ...product,
    price: product.price / 100,
    displayPrice: (product.price / 100).toFixed(2)
  }

  const costPriceFen = getStoredCostPrice(product)
  if (costPriceFen !== undefined) {
    const costPrice = costPriceFen / 100
    normalized.costPrice = costPrice
    normalized.originalPrice = costPrice
  }

  return normalized
}

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
    case 'exportProducts':
      result = await exportProducts(data, context);
      break;
    case 'importProducts':
      result = await importProducts(data, context);
      break;
    default:
      result = paramError('action', 'Unsupported action type');
  }
  
  // 记录执行时间
  const executionTime = Date.now() - startTime;
  console.log('[PRODUCT_MANAGEMENT] Request completed:', {
    action,
    executionTime: `${executionTime}ms`,
    success: result.code === 200
  });
  
  return result;
};

/**
 * 获取商品列表
 */
async function getProducts(data, context) {
  const startTime = Date.now();
  const { OPENID } = cloud.getWXContext();
  const safeData = data || {};
  const { page = 1, size = 10, keyword, status, orderBy = 'createTime', orderDirection = 'desc' } = safeData;
  // 兼容 category 和 categoryId 两种参数名
  const category = safeData.category ?? safeData.categoryId;
  
  // 验证是否为管理员
  const isAdmin = await verifyAdminByOpenid(OPENID);
  
  console.log('[PRODUCT_MANAGEMENT] getProducts:', {
    page, size, category, keyword, status, orderBy, orderDirection, isAdmin
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
    
    // 状态筛选 - 非管理员强制只能查看上架商品
    if (isAdmin) {
      // 管理员：可按status筛选，不传则查全部
      if (status !== undefined && status !== '') {
        conditions.push({ status: parseInt(status) });
      }
    } else {
      // 非管理员：强制只查上架商品(status=1)
      conditions.push({ status: 1 });
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
    
    // 构建计数查询
    let countQuery = db.collection('products');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }

    // 并行执行查询和计数，提升性能
    const [result, countResult] = await Promise.all([
      query.get(),
      countQuery.count()
    ]);
    
    // 格式化商品数据
    const products = result.data.map((product) => normalizeProductOutput(product));
    
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
  const { OPENID } = cloud.getWXContext();
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
    
    // 非管理员不能访问下架商品
    const isAdmin = await verifyAdminByOpenid(OPENID);
    if (!isAdmin && result.data.status !== 1) {
      console.warn('[PRODUCT_MANAGEMENT] Non-admin access to unpublished product:', { productId: id });
      return notFoundError('Product');
    }
    
    // 处理价格显示（从分转换为元）
    const product = normalizeProductOutput(result.data);
    
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
  const input = { ...(data || {}) }

  console.log('[PRODUCT_MANAGEMENT] createProduct:', {
    openid: OPENID,
    productName: input?.name
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can create product');
  }

  // [殡葬平台转型] 服务端强制校验，只允许 white 类型（含未传 type 的兜底）
  if (input?.type !== 'white') {
    if (input?.type !== undefined) {
      console.log('[殡葬平台转型] 强制覆写红事类型为白事', {
        originalType: input.type,
        forcedType: 'white',
        function: 'createProduct'
      });
    }
    input.type = 'white';
  }

  // 数据验证
  if (!input?.name || !input?.price) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: Missing required fields');
    return paramError('name/price', 'Product name and price are required');
  }

  if (input.price <= 0) {
    console.warn('[PRODUCT_MANAGEMENT] createProduct failed: Invalid price', { price: input.price });
    return paramError('price', 'Product price must be greater than 0');
  }

  const providedCostPrice = getProvidedCostPrice(input)
  if (providedCostPrice !== undefined) {
    const parsedCostPrice = Number(providedCostPrice)
    if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      return paramError('costPrice', 'Product cost price must be greater than or equal to 0')
    }
  }

  // 敏感词检测
  const nameCheck = checkSensitiveWords(input.name, 'name');
  if (!nameCheck.valid) {
    return paramError('name', `商品名称包含敏感词：${nameCheck.matchedWords.join(', ')}`);
  }
  if (input.description) {
    const descCheck = checkSensitiveWords(input.description, 'description');
    if (!descCheck.valid) {
      return paramError('description', `商品描述包含敏感词：${descCheck.matchedWords.join(', ')}`);
    }
  }

  try {
    // 如果有分类ID,查询分类名称
    let categoryName = '';
    if (input.category) {
      try {
        const categoryResult = await db.collection('categories').doc(input.category).get();
        if (categoryResult.data) {
          categoryName = categoryResult.data.name;
        }
      } catch (err) {
        console.warn('[PRODUCT_MANAGEMENT] Failed to get category name:', err.message);
      }
    }

    if (categoryName) {
      const categoryCheck = checkSensitiveWords(categoryName, 'categoryName');
      if (!categoryCheck.valid) {
        return paramError('categoryName', `分类名称包含敏感词：${categoryCheck.matchedWords.join(', ')}`);
      }
    }

    // 构建商品数据
    const product = {
      ...input,
      categoryName, // 保存分类名称
      price: Math.round(input.price * 100), // 转换为分
      createTime: new Date(),
      updateTime: new Date(),
      status: input.status || 1,
      creatorOpenid: OPENID
    };

    delete product.originalPrice

    if (providedCostPrice !== undefined) {
      product.costPrice = Math.round(Number(providedCostPrice) * 100)
    }

    // 保存到数据库
    const result = await db.collection('products').add({
      data: product
    });

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] createProduct success:', {
      productId: result._id,
      productName: input.name,
      categoryName,
      executionTime: `${executionTime}ms`
    });

    return success({
      _id: result._id,
      ...normalizeProductOutput(product)
    }, 'Create product success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[PRODUCT_MANAGEMENT] createProduct failed:', {
      productName: input?.name,
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
  const payload = data || {}
  const {
    id,
    isAdmin: _clientIsAdmin,
    originalPrice: legacyOriginalPrice,
    costPrice: incomingCostPrice,
    ...updateData
  } = payload;

  console.log('[PRODUCT_MANAGEMENT] updateProduct:', {
    openid: OPENID,
    productId: id
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[PRODUCT_MANAGEMENT] updateProduct failed: No admin permission', { openid: OPENID, productId: id });
    return permissionError('Only admin can update product');
  }

  if (!id) {
    console.warn('[PRODUCT_MANAGEMENT] updateProduct failed: Missing product ID');
    return paramError('id', 'Product ID is required');
  }

  // [殡葬平台转型] 服务端强制校验，只允许 white 类型
  if (payload?.type && payload.type !== 'white') {
    console.log('[殡葬平台转型] 强制覆写红事类型为白事', {
      originalType: payload.type,
      forcedType: 'white',
      function: 'updateProduct'
    });
    if (updateData.type !== undefined) {
      updateData.type = 'white';
    }
  }

  const providedCostPrice = getProvidedCostPrice({
    costPrice: incomingCostPrice,
    originalPrice: legacyOriginalPrice
  })

  if (providedCostPrice !== undefined) {
    const parsedCostPrice = Number(providedCostPrice)
    if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      return paramError('costPrice', 'Product cost price must be greater than or equal to 0')
    }
    updateData.costPrice = providedCostPrice
  }

  // 敏感词检测
  if (updateData.name !== undefined) {
    const nameCheck = checkSensitiveWords(updateData.name, 'name');
    if (!nameCheck.valid) {
      return paramError('name', `商品名称包含敏感词：${nameCheck.matchedWords.join(', ')}`);
    }
  }
  if (updateData.description !== undefined) {
    const descCheck = checkSensitiveWords(updateData.description, 'description');
    if (!descCheck.valid) {
      return paramError('description', `商品描述包含敏感词：${descCheck.matchedWords.join(', ')}`);
    }
  }

  try {
    // 如果更新了分类ID,查询分类名称
    if (updateData.category) {
      try {
        const categoryResult = await db.collection('categories').doc(updateData.category).get();
        if (categoryResult.data) {
          updateData.categoryName = categoryResult.data.name;
        }
      } catch (err) {
        console.warn('[PRODUCT_MANAGEMENT] Failed to get category name:', err.message);
      }
    }

    if (updateData.categoryName) {
      const categoryCheck = checkSensitiveWords(updateData.categoryName, 'categoryName');
      if (!categoryCheck.valid) {
        return paramError('categoryName', `分类名称包含敏感词：${categoryCheck.matchedWords.join(', ')}`);
      }
    }

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

    if (updateData.costPrice !== undefined) {
      updateFields.costPrice = Math.round(Number(updateData.costPrice) * 100)
    }

    // 更新商品
    await db.collection('products').doc(id).update({
      data: updateFields
    });

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] updateProduct success:', {
      productId: id,
      categoryName: updateData.categoryName,
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
  const { id, isAdmin: _clientIsAdmin } = data || {};

  console.log('[PRODUCT_MANAGEMENT] deleteProduct:', {
    openid: OPENID,
    productId: id
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
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
  const { id, stock, isAdmin: _clientIsAdmin } = data || {};

  console.log('[PRODUCT_MANAGEMENT] updateStock:', {
    openid: OPENID,
    productId: id,
    newStock: stock
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
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

// ============ CSV 工具函数 ============

/**
 * CSV 字段转义：含逗号、引号、换行的字段用双引号包裹
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // CSV Injection 防护：以 =、+、-、@ 开头的值前置单引号
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * 解析 CSV 字符串为对象数组
 */
function parseCSV(csvString) {
  const lines = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // 解析表头
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;
    const record = {};
    headers.forEach((header, idx) => {
      record[header.trim()] = (values[idx] || '').trim();
    });
    records.push(record);
  }
  return records;
}

/**
 * 解析单行 CSV（处理引号内的逗号）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// ============ 导出商品 ============

/**
 * 导出商品为 CSV 并上传到云存储
 */
async function exportProducts(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('Only admin can export products');
  }

  try {
    // 导出保护：限制最大导出量，避免内存占用过高
    const MAX_LIMIT = 100;
    const MAX_EXPORT_ITEMS = 1000;
    const countResult = await db.collection('products').count();
    const total = countResult.total;

    if (total > MAX_EXPORT_ITEMS) {
      return error(
        ErrorCodes.LIMIT_EXCEEDED,
        `Export limit exceeded: ${total} items (max ${MAX_EXPORT_ITEMS}). Please narrow down and retry.`
      );
    }

    const exportTotal = Math.min(total, MAX_EXPORT_ITEMS);
    const batchTimes = Math.ceil(exportTotal / MAX_LIMIT);

    // CSV 表头（中文 + 英文字段名映射）
    const csvHeaders = [
      '商品ID', '商品名称', '价格(元)', '进价(元)', '原价(元)', '库存',
      '分类ID', '分类名称', '描述', '状态(1上架/0下架)',
      '图片URL', '销量', '创建时间'
    ];

    // 生成 CSV 内容
    let csvContent = '\uFEFF' + csvHeaders.join(',') + '\n'; // BOM for Excel
    let exportedCount = 0;

    // 分批生成 CSV，避免将全部商品对象堆积在内存
    for (let i = 0; i < batchTimes; i++) {
      const currentLimit = Math.min(MAX_LIMIT, exportTotal - i * MAX_LIMIT);
      if (currentLimit <= 0) break;

      const batchResult = await db.collection('products')
        .skip(i * MAX_LIMIT)
        .limit(currentLimit)
        .orderBy('createTime', 'desc')
        .get();

      batchResult.data.forEach(p => {
        const costPriceFen = getStoredCostPrice(p)
        const costPriceYuan = costPriceFen !== undefined ? (costPriceFen / 100).toFixed(2) : ''
        const row = [
          csvEscape(p._id),
          csvEscape(p.name || ''),
          csvEscape(p.price !== undefined ? (p.price / 100).toFixed(2) : ''),
          csvEscape(costPriceYuan),
          csvEscape(costPriceYuan),
          csvEscape(p.stock !== undefined ? p.stock : ''),
          csvEscape(p.category || ''),
          csvEscape(p.categoryName || ''),
          csvEscape(p.description || ''),
          csvEscape(p.status !== undefined ? p.status : 1),
          csvEscape(p.imageUrl || p.thumb || ''),
          csvEscape(p.sales || 0),
          csvEscape(p.createTime ? new Date(p.createTime).toISOString() : '')
        ];
        csvContent += row.join(',') + '\n';
      });

      exportedCount += batchResult.data.length;
    }

    // 上传到云存储
    const fileName = `temp/products_export_${Date.now()}.csv`;
    const uploadResult = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: Buffer.from(csvContent, 'utf-8')
    });

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] exportProducts success:', {
      total: exportedCount,
      fileID: uploadResult.fileID,
      executionTime: `${executionTime}ms`
    });

    return success({
      fileID: uploadResult.fileID,
      total: exportedCount,
      fileName: `products_export_${new Date().toISOString().slice(0, 10)}.csv`
    }, 'Export products success');
  } catch (err) {
    console.error('[PRODUCT_MANAGEMENT] exportProducts failed:', err);
    return dbError('Failed to export products', { originalError: err.message });
  }
}

// ============ 导入商品 ============

/**
 * 从 CSV 数据批量导入商品
 */
async function importProducts(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    return permissionError('Only admin can import products');
  }

  const { csvContent, mode = 'append' } = data || {};
  if (!csvContent) {
    return paramError('csvContent', 'CSV content is required');
  }

  // 当前仅支持追加导入，避免前后端语义不一致
  if (mode !== 'append') {
    return paramError('mode', 'Only append mode is supported');
  }

  try {
    const records = parseCSV(csvContent);
    if (records.length === 0) {
      return paramError('csvContent', 'CSV file is empty or has no data rows');
    }

    // 字段映射：中文表头 → 数据库字段
    const fieldMap = {
      '商品名称': 'name',
      '价格(元)': 'price',
      '进价(元)': 'costPrice',
      '原价(元)': 'originalPrice',
      '库存': 'stock',
      '类型': 'type',
      '分类ID': 'category',
      '分类名称': 'categoryName',
      '描述': 'description',
      '状态(1上架/0下架)': 'status',
      '图片URL': 'imageUrl',
      // 英文字段名也支持
      'name': 'name',
      'price': 'price',
      'costPrice': 'costPrice',
      'originalPrice': 'originalPrice',
      'stock': 'stock',
      'type': 'type',
      'category': 'category',
      'categoryName': 'categoryName',
      'description': 'description',
      'status': 'status',
      'imageUrl': 'imageUrl'
    };

    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const pendingProducts = [];

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      const rowNumber = i + 2;
      try {
        // 映射字段
        const mapped = {};
        Object.keys(raw).forEach(key => {
          const dbField = fieldMap[key];
          if (dbField && raw[key]) {
            mapped[dbField] = raw[key];
          }
        });

        // 验证必填字段
        if (!mapped.name) {
          errors.push({ row: rowNumber, error: '商品名称不能为空' });
          failCount++;
          continue;
        }

        // 与 create/update 保持一致：敏感词校验
        const nameCheck = checkSensitiveWords(mapped.name, 'name');
        if (!nameCheck.valid) {
          errors.push({ row: rowNumber, error: `商品名称包含敏感词：${nameCheck.matchedWords.join(', ')}` });
          failCount++;
          continue;
        }
        if (mapped.description) {
          const descCheck = checkSensitiveWords(mapped.description, 'description');
          if (!descCheck.valid) {
            errors.push({ row: rowNumber, error: `商品描述包含敏感词：${descCheck.matchedWords.join(', ')}` });
            failCount++;
            continue;
          }
        }
        if (mapped.categoryName) {
          const categoryCheck = checkSensitiveWords(mapped.categoryName, 'categoryName');
          if (!categoryCheck.valid) {
            errors.push({ row: rowNumber, error: `分类名称包含敏感词：${categoryCheck.matchedWords.join(', ')}` });
            failCount++;
            continue;
          }
        }

        const price = parseFloat(mapped.price);
        if (isNaN(price) || price <= 0) {
          errors.push({ row: rowNumber, error: `价格无效: ${mapped.price}` });
          failCount++;
          continue;
        }

        // 构建商品数据
        const product = {
          name: mapped.name,
          price: Math.round(price * 100), // 转换为分
          stock: parseInt(mapped.stock) || 0,
          status: parseInt(mapped.status) === 0 ? 0 : 1,
          // [殡葬平台转型] 导入场景强制写入白事类型
          type: 'white',
          description: mapped.description || '',
          category: mapped.category || '',
          categoryName: mapped.categoryName || '',
          imageUrl: mapped.imageUrl || '',
          createTime: new Date(),
          updateTime: new Date(),
          creatorOpenid: OPENID
        };

        const providedCostPrice = getProvidedCostPrice(mapped)
        if (providedCostPrice !== undefined) {
          const parsedCostPrice = parseFloat(providedCostPrice)
          if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
            errors.push({ row: rowNumber, error: `进价无效: ${providedCostPrice}` });
            failCount++;
            continue;
          }
          product.costPrice = Math.round(parsedCostPrice * 100);
        }

        pendingProducts.push({ row: rowNumber, product });
      } catch (rowErr) {
        errors.push({ row: rowNumber, error: rowErr.message });
        failCount++;
      }
    }

    // 分块并发写入，避免大批量串行导致超时
    const BATCH_WRITE_SIZE = 20;
    for (let i = 0; i < pendingProducts.length; i += BATCH_WRITE_SIZE) {
      const chunk = pendingProducts.slice(i, i + BATCH_WRITE_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          try {
            await db.collection('products').add({ data: item.product });
            return { success: true, row: item.row };
          } catch (err) {
            return { success: false, row: item.row, error: err.message };
          }
        })
      );

      chunkResults.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          errors.push({ row: result.row, error: result.error || '数据库写入失败' });
        }
      });
    }

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] importProducts completed:', {
      total: records.length,
      successCount,
      failCount,
      executionTime: `${executionTime}ms`
    });

    return success({
      mode,
      total: records.length,
      successCount,
      failCount,
      errors: errors.slice(0, 20) // 最多返回前20条错误
    }, `Import completed: ${successCount} success, ${failCount} failed`);
  } catch (err) {
    console.error('[PRODUCT_MANAGEMENT] importProducts failed:', err);
    return dbError('Failed to import products', { originalError: err.message });
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'productManagement' });
