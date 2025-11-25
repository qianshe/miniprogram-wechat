// 分类管理云函数
// 支持分类查询、创建、更新、删除等功能
// 采用软删除策略，删除时仅标记为禁用状态

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  const startTime = Date.now();

  // 记录请求日志
  console.log(`[${new Date().toISOString()}] 分类管理云函数调用:`, {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });

  try {
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
      case 'migrateCategories':
        result = await migrateCategories(data, context);
        break;
      case 'cleanupRedCategories':
        result = await cleanupRedCategories(data, context);
        break;
      default:
        result = {
          code: 400,
          message: '不支持的操作类型'
        };
    }

    // 记录执行时间
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 分类管理云函数执行完成:`, {
      action,
      executionTime: `${executionTime}ms`,
      success: result.code === 200
    });

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 分类管理云函数执行错误:`, {
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
  } = data;

  console.log(`[${new Date().toISOString()}] 开始获取分类列表:`, {
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
    const categoriesResult = await query.skip(skip).limit(size).get();

    // 获取总数
    let countQuery = db.collection('categories');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }
    const countResult = await countQuery.count();

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
    console.log(`[${new Date().toISOString()}] 分类列表获取成功:`, {
      count: categories.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '获取分类列表成功',
      data: {
        records: categories,
        total: countResult.total,
        page: parseInt(page),
        size: parseInt(size),
        hasMore: categories.length === size
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 获取分类列表失败:`, {
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '获取分类列表失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 获取分类详情
 */
async function getCategoryDetail(data, context) {
  const startTime = Date.now();
  const { id, includeProductCount = true } = data;

  console.log(`[${new Date().toISOString()}] 开始获取分类详情:`, { categoryId: id });

  if (!id) {
    console.warn('获取分类详情失败: 分类ID为空');
    return {
      code: 400,
      message: '分类ID不能为空'
    };
  }

  try {
    // 查询分类详情
    const result = await db.collection('categories').doc(id).get();

    if (!result.data) {
      console.warn('分类不存在:', { categoryId: id });
      return {
        code: 404,
        message: '分类不存在'
      };
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
    console.log(`[${new Date().toISOString()}] 分类详情获取成功:`, {
      categoryId: id,
      categoryName: category.name,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '获取分类详情成功',
      data: category
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 获取分类详情失败:`, {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '获取分类详情失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 创建分类
 */
async function createCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 开始创建分类:`, {
    openid: OPENID,
    categoryName: data.name,
    type: data.type,
    isAdmin: data.isAdmin
  });

  // 权限检查 - 只有管理员可以创建分类
  if (!data.isAdmin) {
    console.warn('创建分类失败: 无管理员权限', { openid: OPENID });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  // 数据验证
  if (!data.name) {
    console.warn('创建分类失败: 分类名称为空');
    return {
      code: 400,
      message: '分类名称不能为空'
    };
  }

  if (!data.type || !Object.values(CATEGORY_TYPE).includes(data.type)) {
    console.warn('创建分类失败: 分类类型无效', { type: data.type });
    return {
      code: 400,
      message: '分类类型无效，必须为 "red" 或 "white"'
    };
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
      console.warn('创建分类失败: 同名分类已存在');
      return {
        code: 400,
        message: '同类型下已存在同名分类'
      };
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
    console.log(`[${new Date().toISOString()}] 分类创建成功:`, {
      categoryId: result._id,
      categoryName: data.name,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '创建分类成功',
      data: {
        _id: result._id,
        ...category
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 创建分类失败:`, {
      categoryName: data.name,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '创建分类失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 更新分类
 */
async function updateCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin, ...updateData } = data;

  console.log(`[${new Date().toISOString()}] 开始更新分类:`, {
    openid: OPENID,
    categoryId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新分类
  if (!isAdmin) {
    console.warn('更新分类失败: 无管理员权限', { openid: OPENID, categoryId: id });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  if (!id) {
    console.warn('更新分类失败: 分类ID为空');
    return {
      code: 400,
      message: '分类ID不能为空'
    };
  }

  try {
    // 检查分类是否存在
    const existingResult = await db.collection('categories').doc(id).get();
    if (!existingResult.data) {
      return {
        code: 404,
        message: '分类不存在'
      };
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
        return {
          code: 400,
          message: '同类型下已存在同名分类'
        };
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

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 分类更新成功:`, {
      categoryId: id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '更新分类成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 更新分类失败:`, {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '更新分类失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 删除分类（软删除）
 * 采用软删除策略，仅将分类状态标记为禁用
 */
async function deleteCategory(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin } = data;

  console.log(`[${new Date().toISOString()}] 开始删除分类:`, {
    openid: OPENID,
    categoryId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以删除分类
  if (!isAdmin) {
    console.warn('删除分类失败: 无管理员权限', { openid: OPENID, categoryId: id });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  if (!id) {
    console.warn('删除分类失败: 分类ID为空');
    return {
      code: 400,
      message: '分类ID不能为空'
    };
  }

  try {
    // 检查分类是否存在
    const existingResult = await db.collection('categories').doc(id).get();
    if (!existingResult.data) {
      return {
        code: 404,
        message: '分类不存在'
      };
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
    console.log(`[${new Date().toISOString()}] 分类删除成功（软删除）:`, {
      categoryId: id,
      hadProducts: productCount.total > 0,
      productCount: productCount.total,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '删除分类成功',
      data: {
        hadProducts: productCount.total > 0,
        productCount: productCount.total,
        notice: productCount.total > 0 
          ? `该分类下有 ${productCount.total} 个商品，建议重新分配这些商品的分类`
          : null
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 删除分类失败:`, {
      categoryId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '删除分类失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 迁移分类数据
 * 将模拟数据迁移到数据库（仅管理员可执行）
 */
async function migrateCategories(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 开始迁移分类数据:`, {
    openid: OPENID,
    isAdmin: data.isAdmin
  });

  // 权限检查 - 只有管理员可以执行迁移
  if (!data.isAdmin) {
    console.warn('迁移分类数据失败: 无管理员权限', { openid: OPENID });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
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
          console.log(`白事分类 "${category.name}" 已存在，跳过`);
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

        console.log(`白事分类 "${category.name}" 创建成功`);
        results.white.success++;
      } catch (err) {
        console.error(`白事分类 "${category.name}" 创建失败:`, err);
        results.white.failed++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 分类数据迁移完成:`, {
      results,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '分类数据迁移完成',
      data: {
        results,
        totalWhite: whiteCategories.length
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 迁移分类数据失败:`, {
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '迁移分类数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}