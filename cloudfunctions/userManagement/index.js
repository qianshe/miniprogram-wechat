// 用户管理云函数
// 支持用户列表查询、管理员权限设置、用户状态管理等功能

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
    console.error('[USER_MANAGEMENT] verifyAdminByOpenid error:', err);
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
  console.log('[USER_MANAGEMENT] Request received:', {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });
  
  let result;
  
  switch (action) {
    case 'getUsers':
      result = await getUsers(data, context);
      break;
    case 'getUserDetail':
      result = await getUserDetail(data, context);
      break;
    case 'setAdminRole':
      result = await setAdminRole(data, context);
      break;
    case 'updateUserStatus':
      result = await updateUserStatus(data, context);
      break;
    default:
      result = paramError('action', 'Unsupported action type');
  }
  
  // 记录执行时间
  const executionTime = Date.now() - startTime;
  console.log('[USER_MANAGEMENT] Request completed:', {
    action,
    executionTime: `${executionTime}ms`,
    success: result.code === 200
  });
  
  return result;
};

/**
 * 获取用户列表
 */
async function getUsers(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { 
    page = 1, 
    size = 20, 
    keyword, 
    isAdmin: filterAdmin,
    status,
    orderBy = 'createTime',
    orderDirection = 'desc'
  } = data || {};
  
  console.log('[USER_MANAGEMENT] getUsers:', {
    page, size, keyword, filterAdmin, status, orderBy, orderDirection
  });
  
  // 服务端权限检查
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[USER_MANAGEMENT] getUsers failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can view user list');
  }
  
  try {
    // 构建查询条件
    let query = db.collection('users');
    const conditions = [];
    
    // 关键词搜索（昵称）
    if (keyword) {
      conditions.push({
        nickName: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      });
    }
    
    // 管理员筛选
    if (filterAdmin !== undefined && filterAdmin !== '') {
      conditions.push({ isAdmin: filterAdmin === true || filterAdmin === 'true' });
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

    // 构建计数查询
    let countQuery = db.collection('users');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }

    // 并行执行查询和计数，提升性能
    const [result, countResult] = await Promise.all([
      query.get(),
      countQuery.count()
    ]);

    // 格式化用户数据（隐藏敏感信息）
    const users = result.data.map(user => ({
      _id: user._id,
      openid: user.openid ? user.openid.substring(0, 8) + '****' : '', // 脱敏
      nickName: user.nickName || '未设置',
      avatarUrl: user.avatarUrl || '',
      role: user.role || 0,
      isAdmin: user.isAdmin || false,
      status: user.status !== undefined ? user.status : 1, // 默认启用
      loginTime: user.loginTime,
      createTime: user.createTime,
      updateTime: user.updateTime
    }));

    const executionTime = Date.now() - startTime;
    console.log('[USER_MANAGEMENT] getUsers success:', {
      count: users.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });

    return success({
      records: users,
      total: countResult.total,
      page: parseInt(page),
      size: parseInt(size),
      hasMore: users.length === size
    }, 'Get user list success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[USER_MANAGEMENT] getUsers failed:', {
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to get user list', { originalError: err.message });
  }
}

/**
 * 获取用户详情
 */
async function getUserDetail(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id } = data || {};

  console.log('[USER_MANAGEMENT] getUserDetail:', { userId: id });

  // 服务端权限检查
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[USER_MANAGEMENT] getUserDetail failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can view user detail');
  }

  if (!id) {
    console.warn('[USER_MANAGEMENT] getUserDetail failed: Missing user ID');
    return paramError('id', 'User ID is required');
  }

  try {
    const result = await db.collection('users').doc(id).get();

    if (!result.data) {
      console.warn('[USER_MANAGEMENT] User not found:', { userId: id });
      return notFoundError('User');
    }

    const user = result.data;

    // 获取用户订单统计
    const orderStats = await db.collection('orders')
      .aggregate()
      .match({ userOpenid: user.openid })
      .group({
        _id: null,
        totalOrders: _.aggregate.sum(1),
        totalAmount: _.aggregate.sum('$totalAmount')
      })
      .end();

    const stats = orderStats.list[0] || { totalOrders: 0, totalAmount: 0 };

    const userDetail = {
      ...user,
      openid: user.openid ? user.openid.substring(0, 8) + '****' : '', // 脱敏
      orderStats: {
        totalOrders: stats.totalOrders,
        totalAmount: stats.totalAmount / 100 // 转换为元
      }
    };

    const executionTime = Date.now() - startTime;
    console.log('[USER_MANAGEMENT] getUserDetail success:', {
      userId: id,
      executionTime: `${executionTime}ms`
    });

    return success(userDetail, 'Get user detail success');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[USER_MANAGEMENT] getUserDetail failed:', {
      userId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to get user detail', { originalError: err.message });
  }
}

/**
 * 设置/取消管理员权限
 */
async function setAdminRole(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin: targetIsAdmin } = data || {};

  console.log('[USER_MANAGEMENT] setAdminRole:', {
    operatorOpenid: OPENID,
    targetUserId: id,
    targetIsAdmin
  });

  // 服务端权限检查
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[USER_MANAGEMENT] setAdminRole failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can set admin role');
  }

  if (!id) {
    console.warn('[USER_MANAGEMENT] setAdminRole failed: Missing user ID');
    return paramError('id', 'User ID is required');
  }

  if (targetIsAdmin === undefined) {
    console.warn('[USER_MANAGEMENT] setAdminRole failed: Missing isAdmin parameter');
    return paramError('isAdmin', 'isAdmin parameter is required');
  }

  try {
    // 检查目标用户是否存在
    const userResult = await db.collection('users').doc(id).get();
    if (!userResult.data) {
      return notFoundError('User');
    }

    // 防止取消自己的管理员权限
    if (userResult.data.openid === OPENID && !targetIsAdmin) {
      return error(ErrorCodes.BUSINESS_ERROR, 'Cannot remove your own admin role');
    }

    // 更新用户权限
    await db.collection('users').doc(id).update({
      data: {
        isAdmin: !!targetIsAdmin,
        role: targetIsAdmin ? 1 : 0,
        updateTime: new Date(),
        updaterOpenid: OPENID
      }
    });

    const executionTime = Date.now() - startTime;
    console.log('[USER_MANAGEMENT] setAdminRole success:', {
      targetUserId: id,
      newIsAdmin: targetIsAdmin,
      executionTime: `${executionTime}ms`
    });

    return success(null, targetIsAdmin ? 'Admin role granted' : 'Admin role revoked');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[USER_MANAGEMENT] setAdminRole failed:', {
      targetUserId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to set admin role', { originalError: err.message });
  }
}

/**
 * 更新用户状态（启用/禁用）
 */
async function updateUserStatus(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, status } = data || {};

  console.log('[USER_MANAGEMENT] updateUserStatus:', {
    operatorOpenid: OPENID,
    targetUserId: id,
    targetStatus: status
  });

  // 服务端权限检查
  const isAdmin = await verifyAdminByOpenid(OPENID);
  if (!isAdmin) {
    console.warn('[USER_MANAGEMENT] updateUserStatus failed: No admin permission', { openid: OPENID });
    return permissionError('Only admin can update user status');
  }

  if (!id) {
    console.warn('[USER_MANAGEMENT] updateUserStatus failed: Missing user ID');
    return paramError('id', 'User ID is required');
  }

  if (status === undefined || ![0, 1].includes(parseInt(status))) {
    console.warn('[USER_MANAGEMENT] updateUserStatus failed: Invalid status', { status });
    return paramError('status', 'Status must be 0 (disabled) or 1 (enabled)');
  }

  try {
    // 检查目标用户是否存在
    const userResult = await db.collection('users').doc(id).get();
    if (!userResult.data) {
      return notFoundError('User');
    }

    // 防止禁用自己
    if (userResult.data.openid === OPENID && parseInt(status) === 0) {
      return error(ErrorCodes.BUSINESS_ERROR, 'Cannot disable yourself');
    }

    // 更新用户状态
    await db.collection('users').doc(id).update({
      data: {
        status: parseInt(status),
        updateTime: new Date(),
        updaterOpenid: OPENID
      }
    });

    const executionTime = Date.now() - startTime;
    console.log('[USER_MANAGEMENT] updateUserStatus success:', {
      targetUserId: id,
      newStatus: status,
      executionTime: `${executionTime}ms`
    });

    return success(null, parseInt(status) === 1 ? 'User enabled' : 'User disabled');
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error('[USER_MANAGEMENT] updateUserStatus failed:', {
      targetUserId: id,
      executionTime: `${executionTime}ms`,
      error: err.message,
      stack: err.stack
    });

    return dbError('Failed to update user status', { originalError: err.message });
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'userManagement' });

