// 分类管理云函数
// 支持分类查询、创建、更新、删除等功能
// 采用软删除策略，删除时仅标记为禁用状态

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
    console.error('[CATEGORY_MANAGEMENT] verifyAdminByOpenid error:', err);
    return false;
  }
}

// 分类状态枚举
const CATEGORY_STATUS = {
  DISABLED: 0,   // 禁用
  ENABLED: 1     // 启用
};

// 分类类型枚举
const CATEGORY_TYPE = {
  WHITE: 'white',  // 白事
  RED: 'red'       // 红事
};

/**
 * 云函数主处理逻辑
 */
const handler = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();

  // 记录请求日志
  console.log('[CATEGORY_MANAGEMENT] Request received:', {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });

  let result;

  switch (action) {
    case 'getCategories':
      result = await getCategories(data, context);
      break;
    case 'getCategoryDetail':
      result = await getCategoryDetail(data, context);
      break;
    case 'createCategory':
      result = await createCategory(data, context);
      break;
    case 'updateCategory':
      result = await updateCategory(data, context);
      break;
    case 'deleteCategory':
      result = await deleteCategory(data, context);
      break;
    case 'batchUpdateCategorySort':
      result = await batchUpdateCategorySort(data, context);
      break;
    case 'migrateCategories':
      result = await migrateCategories(data, context);
      break;
    case 'cleanupRedCategories':
      result = await cleanupRedCategories(data, context);
      break;
    default:
      result = paramError('action', 'Unsupported action type');
  }

  // 记录执行时间
  const executionTime = Date.now() - startTime;
  console.log('[CATEGORY_MANAGEMENT] Request completed:', {
    action,
    executionTime: `${executionTime}ms`,
    success: result.code === 200
  });

  return result;
};

/**
 * 获取分类列表
 */
async function getCategories(data, context) {
  const startTime = Date.now();
  const {
    type,
    page = 1,
    size = 20,
    status,
    includeProductCount = true
  } = data || {};

  console.log('[CATEGORY_MANAGEMENT] getCategories:', {
    type, page, size, status, includeProductCount
  });

  try {
    // 构建查询条件
    let query = db.collection('categories');
    const conditions = [];

    // 分类类型筛选
    if (type) {
      conditions.push({ type });
    }

    // 状态筛选
    if (status !== undefined && status !== null && status !== '') {
      conditions.push({ status: parseInt(status) });
    }

    // 应用查询条件
    if (conditions.length > 0) {
      query = query.where(_.and(conditions));
    }

    // 排序：按sort升序，createTime降序
    query = query.orderBy('sort', 'asc').orderBy('createTime', 'desc');

    // 分页
    const skip = (page - 1) * size;

    // 构建计数查询
    let countQuery = db.collection('categories');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }

    // 并行执行查询和计数，提升性能
    const [categoriesResult, countResult] = await Promise.all([
      query.skip(skip).limit(size).get(),
      countQuery.count()
    ]);

    // 格式化分类数据
    let categories = categoriesResult.data;

    // 统计每个分类下的商品数量
    if (includeProductCount && categories.length > 0) {
      const categoryIds = categories.map(c => c._id);
      
      // 使用聚合查询统计商品数量
      const productCounts = await db.collection('products')
        .aggregate()
        .match({
          category: _.in(categoryIds),
          status: 1  // 只统计启用状态的商品
        })
        .group({
          _id: '$category',
          count: _.aggregate.sum(1)
        })
        .end();

      // 构建分类ID到商品数量的映射
      const countMap = {};
      productCounts.list.forEach(item => {
        countMap[item._id] = item.count;
      });

      // 添加商品数量到分类数据
      categories = categories.map(category => ({
        ...category,
        productCount: countMap[category._id] || 0
      }));
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] getCategories success:', {
      count: categories.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });

    return success({
      records: categories,
      total: countResult.total,
      page: parseInt(page),
      size: parseInt(size),
      hasMore: categories.length === size
    }, 'Get category list success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] getCategories failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to get category list', { originalError: err.message });
  }
}

/**
 * 获取分类详情
 */
async function getCategoryDetail(data, context) {
  const startTime = Date.now();
  const { id, includeProductCount = true } = data || {};

  console.log('[CATEGORY_MANAGEMENT] getCategoryDetail:', { categoryId: id });

  if (!id) {
    console.warn('[CATEGORY_MANAGEMENT] getCategoryDetail failed: Missing category ID');
    return paramError('id', 'Category ID is required');
  }

  try {
    // 查询分类详情
    const result = await db.collection('categories').doc(id).get();

    if (!result.data) {
      console.warn('[CATEGORY_MANAGEMENT] Category not found:', { categoryId: id });
      return notFoundError('Category');
    }

    let category = result.data;

    // 统计该分类下的商品数量
    if (includeProductCount) {
      const productCountResult = await db.collection('products')
        .where({
          category: id,
          status: 1  // 只统计启用状态的商品
        })
        .count();
      
      category = {
        ...category,
        productCount: productCountResult.total
      };
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] getCategoryDetail success:', {
      categoryId: id,
      categoryName: category.name,
      executionTime: `${executionTime}ms`
    });

    return success(category, 'Get category detail success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] getCategoryDetail failed:', {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to get category detail', { originalError: err.message });
  }
}

/**
 * 创建分类
 */
async function createCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log('[CATEGORY_MANAGEMENT] createCategory:', {
    openid: OPENID,
    categoryName: data?.name,
    type: data?.type
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] createCategory failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can create category');
  }

  // 数据验证
  if (!data?.name) {
    console.warn('[CATEGORY_MANAGEMENT] createCategory failed: Missing name');
    return paramError('name', 'Category name is required');
  }

  if (!data?.type || !Object.values(CATEGORY_TYPE).includes(data.type)) {
    console.warn('[CATEGORY_MANAGEMENT] createCategory failed: Invalid type', { type: data?.type });
    return paramError('type', 'Category type must be "red" or "white"');
  }

  try {
    // 检查同类型下是否存在同名分类
    const existingCategory = await db.collection('categories')
      .where({
        name: data.name,
        type: data.type
      })
      .get();

    if (existingCategory.data.length > 0) {
      console.warn('[CATEGORY_MANAGEMENT] createCategory failed: Duplicate name');
      return error(ErrorCodes.BUSINESS_ERROR, 'Category with same name already exists in this type');
    }

    // 获取当前最大排序值
    const maxSortResult = await db.collection('categories')
      .where({ type: data.type })
      .orderBy('sort', 'desc')
      .limit(1)
      .get();
    
    const maxSort = maxSortResult.data.length > 0 ? maxSortResult.data[0].sort : 0;

    // 构建分类数据
    const category = {
      name: data.name,
      type: data.type,
      sort: data.sort !== undefined ? parseInt(data.sort) : maxSort + 1,
      status: CATEGORY_STATUS.ENABLED,
      icon: data.icon || '',
      description: data.description || '',
      createTime: new Date(),
      updateTime: new Date(),
      creatorOpenid: OPENID
    };

    // 保存到数据库
    const result = await db.collection('categories').add({
      data: category
    });

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] createCategory success:', {
      categoryId: result._id,
      categoryName: data.name,
      executionTime: `${executionTime}ms`
    });

    return success({
      _id: result._id,
      ...category
    }, 'Create category success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] createCategory failed:', {
      categoryName: data?.name,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to create category', { originalError: err.message });
  }
}

/**
 * 更新分类
 */
async function updateCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin: _clientIsAdmin, ...updateData } = data || {};

  console.log('[CATEGORY_MANAGEMENT] updateCategory:', {
    openid: OPENID,
    categoryId: id
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] updateCategory failed: No admin permission', { openid: OPENID, categoryId: id });
    return permissionError('Only admin can update category');
  }

  if (!id) {
    console.warn('[CATEGORY_MANAGEMENT] updateCategory failed: Missing category ID');
    return paramError('id', 'Category ID is required');
  }

  try {
    // 检查分类是否存在
    const existingResult = await db.collection('categories').doc(id).get();
    if (!existingResult.data) {
      return notFoundError('Category');
    }

    // 如果更新名称，检查是否与同类型下其他分类重名
    if (updateData.name && updateData.name !== existingResult.data.name) {
      const duplicateCheck = await db.collection('categories')
        .where({
          name: updateData.name,
          type: existingResult.data.type,
          _id: _.neq(id)
        })
        .get();

      if (duplicateCheck.data.length > 0) {
        return error(ErrorCodes.BUSINESS_ERROR, 'Category with same name already exists in this type');
      }
    }

    // 构建更新数据
    const updateFields = {
      ...updateData,
      updateTime: new Date(),
      updaterOpenid: OPENID
    };

    // 移除不允许更新的字段
    delete updateFields.type;  // 分类类型不允许修改
    delete updateFields.creatorOpenid;
    delete updateFields.createTime;

    // 如果包含sort，转换为数字
    if (updateData.sort !== undefined) {
      updateFields.sort = parseInt(updateData.sort);
    }

    // 更新分类
    await db.collection('categories').doc(id).update({
      data: updateFields
    });

    // 如果更新了分类名称，同步更新所有关联产品的 categoryName
    let productsUpdated = 0;
    if (updateData.name && updateData.name !== existingResult.data.name) {
      console.log('[CATEGORY_MANAGEMENT] Category name changed, syncing products categoryName:', {
        categoryId: id,
        oldName: existingResult.data.name,
        newName: updateData.name
      });

      const productsCollection = db.collection('products');
      let hasMore = true;

      while (hasMore) {
        const products = await productsCollection
          .where({ category: id })
          .limit(100)
          .get();

        if (products.data.length === 0) {
          hasMore = false;
          break;
        }

        for (const product of products.data) {
          if (product.categoryName !== updateData.name) {
            await productsCollection.doc(product._id).update({
              data: { 
                categoryName: updateData.name,
                updateTime: new Date()
              }
            });
            productsUpdated++;
          }
        }

        if (products.data.length < 100) hasMore = false;
      }

      console.log('[CATEGORY_MANAGEMENT] Products categoryName synced:', {
        categoryId: id,
        productsUpdated
      });
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] updateCategory success:', {
      categoryId: id,
      productsUpdated,
      executionTime: `${executionTime}ms`
    });

    return success({ productsUpdated }, 'Update category success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] updateCategory failed:', {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update category', { originalError: err.message });
  }
}

/**
 * 批量更新分类排序
 */
async function batchUpdateCategorySort(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { items, isAdmin: _clientIsAdmin } = data || {};

  console.log('[CATEGORY_MANAGEMENT] batchUpdateCategorySort:', {
    openid: OPENID,
    itemsCount: items?.length
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] batchUpdateCategorySort failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can batch update category sort');
  }

  // 参数验证
  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn('[CATEGORY_MANAGEMENT] batchUpdateCategorySort failed: Invalid items');
    return paramError('items', 'Items must be a non-empty array');
  }

  try {
    // 分块处理，每批最多处理 BATCH_SIZE 条
    const BATCH_SIZE = 10;
    let updatedCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const updatePromises = batch.map(item => {
        if (!item.id || item.sort === undefined) {
          return Promise.reject(new Error('Each item must have id and sort'));
        }
        
        return db.collection('categories').doc(item.id).update({
          data: {
            sort: parseInt(item.sort),
            updateTime: new Date(),
            updaterOpenid: OPENID
          }
        });
      });
      
      await Promise.all(updatePromises);
      updatedCount += batch.length;
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] batchUpdateCategorySort success:', {
      updatedCount: items.length,
      executionTime: `${executionTime}ms`
    });

    return success({ updatedCount: items.length }, 'Batch update category sort success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] batchUpdateCategorySort failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to batch update category sort', { originalError: err.message });
  }
}

/**
 * 删除分类（软删除）
 * 采用软删除策略，仅将分类状态标记为禁用
 */
async function deleteCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin: _clientIsAdmin } = data || {};

  console.log('[CATEGORY_MANAGEMENT] deleteCategory:', {
    openid: OPENID,
    categoryId: id
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] deleteCategory failed: No admin permission', { openid: OPENID, categoryId: id });
    return permissionError('Only admin can delete category');
  }

  if (!id) {
    console.warn('[CATEGORY_MANAGEMENT] deleteCategory failed: Missing category ID');
    return paramError('id', 'Category ID is required');
  }

  try {
    // 检查分类是否存在
    const existingResult = await db.collection('categories').doc(id).get();
    if (!existingResult.data) {
      return notFoundError('Category');
    }

    // 检查分类下是否有商品
    const productCount = await db.collection('products')
      .where({
        category: id,
        status: 1  // 只检查启用状态的商品
      })
      .count();

    // 软删除 - 将状态设置为禁用
    await db.collection('categories').doc(id).update({
      data: {
        status: CATEGORY_STATUS.DISABLED,
        updateTime: new Date(),
        updaterOpenid: OPENID,
        deleteTime: new Date()  // 记录删除时间
      }
    });

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] deleteCategory success (soft delete):', {
      categoryId: id,
      hadProducts: productCount.total > 0,
      productCount: productCount.total,
      executionTime: `${executionTime}ms`
    });

    return success({
      hadProducts: productCount.total > 0,
      productCount: productCount.total,
      notice: productCount.total > 0 
        ? `This category has ${productCount.total} products, please reassign them to other categories`
        : null
    }, 'Delete category success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] deleteCategory failed:', {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to delete category', { originalError: err.message });
  }
}

/**
 * 迁移分类数据
 * 将模拟数据迁移到数据库（仅管理员可执行）
 */
async function migrateCategories(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log('[CATEGORY_MANAGEMENT] migrateCategories:', {
    openid: OPENID
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] migrateCategories failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can migrate categories');
  }

  // 预定义的白事分类数据
  const whiteCategories = [
    { name: '骨灰盒', sort: 1 },
    { name: '寿衣寿具', sort: 2 },
    { name: '花圈花篮', sort: 3 },
    { name: '丧葬服务', sort: 4 },
    { name: '殡葬用品', sort: 5 }
  ];

  try {
    const results = {
      white: { success: 0, skipped: 0, failed: 0 }
    };

    // 迁移白事分类
    for (const category of whiteCategories) {
      try {
        // 检查是否已存在
        const existing = await db.collection('categories')
          .where({
            name: category.name,
            type: CATEGORY_TYPE.WHITE
          })
          .get();

        if (existing.data.length > 0) {
          console.log(`[CATEGORY_MANAGEMENT] White category "${category.name}" already exists, skipping`);
          results.white.skipped++;
          continue;
        }

        // 创建分类
        await db.collection('categories').add({
          data: {
            name: category.name,
            type: CATEGORY_TYPE.WHITE,
            sort: category.sort,
            status: CATEGORY_STATUS.ENABLED,
            icon: '',
            description: '',
            createTime: new Date(),
            updateTime: new Date(),
            creatorOpenid: OPENID
          }
        });

        console.log(`[CATEGORY_MANAGEMENT] White category "${category.name}" created successfully`);
        results.white.success++;
      } catch (err) {
        console.error(`[CATEGORY_MANAGEMENT] White category "${category.name}" creation failed:`, err);
        results.white.failed++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] migrateCategories completed:', {
      results,
      executionTime: `${executionTime}ms`
    });

    return success({
      results,
      totalWhite: whiteCategories.length
    }, 'Category migration completed');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] migrateCategories failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to migrate categories', { originalError: err.message });
  }
}

/**
 * 清理红事分类
 * 删除所有红事类型的分类（仅管理员可执行）
 */
async function cleanupRedCategories(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log('[CATEGORY_MANAGEMENT] cleanupRedCategories:', {
    openid: OPENID
  });

  // 服务端权限检查 - 通过数据库验证管理员身份
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[CATEGORY_MANAGEMENT] cleanupRedCategories failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can cleanup red categories');
  }

  try {
    // 查找所有红事分类
    const redCategories = await db.collection('categories')
      .where({
        type: CATEGORY_TYPE.RED
      })
      .get();

    if (redCategories.data.length === 0) {
      console.log('[CATEGORY_MANAGEMENT] No red categories found to cleanup');
      return success({
        deletedCount: 0
      }, 'No red categories to cleanup');
    }

    // 删除所有红事分类
    let deletedCount = 0;
    for (const category of redCategories.data) {
      try {
        await db.collection('categories').doc(category._id).remove();
        deletedCount++;
        console.log(`[CATEGORY_MANAGEMENT] Red category "${category.name}" deleted`);
      } catch (err) {
        console.error(`[CATEGORY_MANAGEMENT] Failed to delete red category "${category.name}":`, err);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log('[CATEGORY_MANAGEMENT] cleanupRedCategories completed:', {
      totalFound: redCategories.data.length,
      deletedCount,
      executionTime: `${executionTime}ms`
    });

    return success({
      totalFound: redCategories.data.length,
      deletedCount
    }, 'Red categories cleanup completed');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[CATEGORY_MANAGEMENT] cleanupRedCategories failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to cleanup red categories', { originalError: err.message });
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'categoryManagement' });