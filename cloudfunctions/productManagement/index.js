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
 * 服务端验证管理员身份
 * 通过查询数据库中的用户记录来验证，而不是信任客户端传来的 isAdmin
 * @param {string} openid - 用户的 openid
 * @returns {Promise<boolean>} 是否为管理员
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
    console.error('[PRODUCT_MANAGEMENT] verifyAdminByOpenid error:', err);
    return false;
  }
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
    productName: data?.name
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
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
    // 如果有分类ID,查询分类名称
    let categoryName = '';
    if (data.category) {
      try {
        const categoryResult = await db.collection('categories').doc(data.category).get();
        if (categoryResult.data) {
          categoryName = categoryResult.data.name;
        }
      } catch (err) {
        console.warn('[PRODUCT_MANAGEMENT] Failed to get category name:', err.message);
      }
    }

    // 构建商品数据
    const product = {
      ...data,
      categoryName, // 保存分类名称
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
      categoryName,
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
  const { id, isAdmin: _clientIsAdmin, ...updateData } = data || {};

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
  const str = String(value);
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
    // 查询所有商品（不分页）
    const MAX_LIMIT = 100;
    const countResult = await db.collection('products').count();
    const total = countResult.total;

    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection('products').skip(i * MAX_LIMIT).limit(MAX_LIMIT).orderBy('createTime', 'desc').get()
      );
    }
    const results = await Promise.all(tasks);
    let allProducts = [];
    results.forEach(r => { allProducts = allProducts.concat(r.data); });

    // CSV 表头（中文 + 英文字段名映射）
    const csvHeaders = [
      '商品ID', '商品名称', '价格(元)', '原价(元)', '库存',
      '分类ID', '分类名称', '描述', '状态(1上架/0下架)',
      '图片URL', '销量', '创建时间'
    ];

    // 生成 CSV 内容
    let csvContent = '\uFEFF' + csvHeaders.join(',') + '\n'; // BOM for Excel

    allProducts.forEach(p => {
      const row = [
        csvEscape(p._id),
        csvEscape(p.name || ''),
        csvEscape(p.price !== undefined ? (p.price / 100).toFixed(2) : ''),
        csvEscape(p.originalPrice !== undefined ? (p.originalPrice / 100).toFixed(2) : ''),
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

    // 上传到云存储
    const fileName = `temp/products_export_${Date.now()}.csv`;
    const uploadResult = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: Buffer.from(csvContent, 'utf-8')
    });

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] exportProducts success:', {
      total: allProducts.length,
      fileID: uploadResult.fileID,
      executionTime: `${executionTime}ms`
    });

    return success({
      fileID: uploadResult.fileID,
      total: allProducts.length,
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

  try {
    const records = parseCSV(csvContent);
    if (records.length === 0) {
      return paramError('csvContent', 'CSV file is empty or has no data rows');
    }

    // 字段映射：中文表头 → 数据库字段
    const fieldMap = {
      '商品名称': 'name',
      '价格(元)': 'price',
      '原价(元)': 'originalPrice',
      '库存': 'stock',
      '分类ID': 'category',
      '分类名称': 'categoryName',
      '描述': 'description',
      '状态(1上架/0下架)': 'status',
      '图片URL': 'imageUrl',
      // 英文字段名也支持
      'name': 'name',
      'price': 'price',
      'originalPrice': 'originalPrice',
      'stock': 'stock',
      'category': 'category',
      'categoryName': 'categoryName',
      'description': 'description',
      'status': 'status',
      'imageUrl': 'imageUrl'
    };

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
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
          errors.push({ row: i + 2, error: '商品名称不能为空' });
          failCount++;
          continue;
        }

        const price = parseFloat(mapped.price);
        if (isNaN(price) || price <= 0) {
          errors.push({ row: i + 2, error: `价格无效: ${mapped.price}` });
          failCount++;
          continue;
        }

        // 构建商品数据
        const product = {
          name: mapped.name,
          price: Math.round(price * 100), // 转换为分
          stock: parseInt(mapped.stock) || 0,
          status: parseInt(mapped.status) === 0 ? 0 : 1,
          description: mapped.description || '',
          category: mapped.category || '',
          categoryName: mapped.categoryName || '',
          imageUrl: mapped.imageUrl || '',
          createTime: new Date(),
          updateTime: new Date(),
          creatorOpenid: OPENID
        };

        if (mapped.originalPrice) {
          product.originalPrice = Math.round(parseFloat(mapped.originalPrice) * 100);
        }

        await db.collection('products').add({ data: product });
        successCount++;
      } catch (rowErr) {
        errors.push({ row: i + 2, error: rowErr.message });
        failCount++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log('[PRODUCT_MANAGEMENT] importProducts completed:', {
      total: records.length,
      successCount,
      failCount,
      executionTime: `${executionTime}ms`
    });

    return success({
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
