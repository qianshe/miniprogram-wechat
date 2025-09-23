// 流程管理云函数
// 支持流程步骤查询、流程详情获取等功能

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
  console.log(`[${new Date().toISOString()}] 流程管理云函数调用:`, {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  });
  
  try {
    let result;
    
    switch (action) {
      case 'getProcessSteps':
        result = await getProcessSteps(data, context);
        break;
      case 'getStepDetail':
        result = await getStepDetail(data, context);
        break;
      case 'createProcessStep':
        result = await createProcessStep(data, context);
        break;
      case 'updateProcessStep':
        result = await updateProcessStep(data, context);
        break;
      case 'deleteProcessStep':
        result = await deleteProcessStep(data, context);
        break;
      default:
        result = {
          code: 400,
          message: '不支持的操作类型'
        };
    }
    
    // 记录执行时间
    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 流程管理云函数执行完成:`, {
      action,
      executionTime: `${executionTime}ms`,
      success: result.code === 200
    });
    
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 流程管理云函数执行错误:`, {
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
 * 检查集合是否存在
 */
async function checkCollectionExists(collectionName) {
  try {
    // 尝试获取集合信息
    const result = await db.collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    // 如果集合不存在，会抛出错误
    if (error.errCode === -502001 || error.message.includes('collection not exist')) {
      return false;
    }
    // 其他错误重新抛出
    throw error;
  }
}

/**
 * 初始化数据库集合和默认数据
 */
async function initDatabase() {
  console.log(`[${new Date().toISOString()}] 开始初始化数据库...`);

  try {
    // 检查processSteps集合是否存在
    const collectionExists = await checkCollectionExists('processSteps');

    if (!collectionExists) {
      console.log(`[${new Date().toISOString()}] processSteps集合不存在，开始创建...`);

      // 创建默认的流程步骤数据
      const defaultSteps = [
        // 白事流程步骤 (type: 0)
        {
          title: '接收逝者',
          description: '专业团队接收逝者，进行初步处理',
          content: '我们的专业团队将以最大的敬意接收逝者，进行必要的初步处理工作。',
          type: 0,
          order: 1,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        },
        {
          title: '遗体整理',
          description: '专业遗体整理，恢复逝者尊严',
          content: '由专业人员进行遗体整理工作，让逝者以最好的状态与家属告别。',
          type: 0,
          order: 2,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        },
        {
          title: '告别仪式',
          description: '庄重的告别仪式，送逝者最后一程',
          content: '举行庄重的告别仪式，让家属和朋友能够正式告别逝者。',
          type: 0,
          order: 3,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        },
        // 红事流程步骤 (type: 1)
        {
          title: '婚礼策划',
          description: '专业婚礼策划，打造完美婚礼',
          content: '我们的专业策划团队将为您量身定制完美的婚礼方案。',
          type: 1,
          order: 1,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        },
        {
          title: '场地布置',
          description: '精美场地布置，营造浪漫氛围',
          content: '专业的场地布置团队将为您打造梦幻般的婚礼现场。',
          type: 1,
          order: 2,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        },
        {
          title: '婚礼仪式',
          description: '神圣的婚礼仪式，见证爱情',
          content: '在亲朋好友的见证下，举行神圣而浪漫的婚礼仪式。',
          type: 1,
          order: 3,
          imageUrl: '',
          productList: [],
          status: 1,
          createTime: new Date(),
          updateTime: new Date()
        }
      ];

      // 批量插入默认数据
      for (const step of defaultSteps) {
        await db.collection('processSteps').add({ data: step });
      }

      console.log(`[${new Date().toISOString()}] 数据库初始化完成，已创建${defaultSteps.length}条默认流程步骤`);
    } else {
      console.log(`[${new Date().toISOString()}] processSteps集合已存在，跳过初始化`);
    }

    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 数据库初始化失败:`, error);
    throw error;
  }
}

/**
 * 获取流程步骤列表
 */
async function getProcessSteps(data, context) {
  const startTime = Date.now();
  const { type = 0, page = 1, size = 20 } = data;

  console.log(`[${new Date().toISOString()}] 开始获取流程步骤:`, {
    type, page, size
  });

  try {
    // 首先检查并初始化数据库
    await initDatabase();

    // 构建查询条件
    let query = db.collection('processSteps');
    const conditions = [];

    // 流程类型筛选 (0: 白事, 1: 红事)
    conditions.push({ type: parseInt(type) });

    // 应用查询条件
    if (conditions.length > 0) {
      query = query.where(_.and(conditions));
    }

    // 排序 - 按order字段升序
    query = query.orderBy('order', 'asc');

    // 分页
    const skip = (page - 1) * size;
    query = query.skip(skip).limit(size);

    // 执行查询
    const result = await query.get();

    // 获取总数
    let countQuery = db.collection('processSteps');
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions));
    }
    const countResult = await countQuery.count();

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 流程步骤获取成功:`, {
      type,
      stepCount: result.data.length,
      total: countResult.total,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '获取流程步骤成功',
      data: {
        records: result.data,
        total: countResult.total,
        page,
        size
      }
    };
  } catch (error) {
    console.error('获取流程步骤失败:', error);
    return {
      code: 500,
      message: '获取流程步骤失败'
    };
  }
}

/**
 * 获取流程步骤详情
 */
async function getStepDetail(data, context) {
  const startTime = Date.now();
  const { id } = data;
  
  console.log(`[${new Date().toISOString()}] 开始获取步骤详情:`, {
    stepId: id
  });
  
  if (!id) {
    console.warn('步骤ID为空');
    return {
      code: 400,
      message: '步骤ID不能为空'
    };
  }
  
  try {
    // 首先尝试使用文档ID查询
    let result;
    try {
      result = await db.collection('processSteps').doc(id).get();
    } catch (docError) {
      // 如果文档ID查询失败，尝试使用where条件查询
      console.log(`[${new Date().toISOString()}] 文档ID查询失败，尝试条件查询:`, { stepId: id });

      // 尝试按order字段查询（如果传入的是数字）
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        const orderResult = await db.collection('processSteps')
          .where('order', '==', numericId)
          .limit(1)
          .get();

        if (orderResult.data && orderResult.data.length > 0) {
          result = { data: orderResult.data[0] };
        }
      }

      // 如果按order查询也没有结果，尝试按title模糊查询
      if (!result || !result.data) {
        const titleResult = await db.collection('processSteps')
          .where('title', '==', id)
          .limit(1)
          .get();

        if (titleResult.data && titleResult.data.length > 0) {
          result = { data: titleResult.data[0] };
        }
      }
    }

    if (!result || !result.data) {
      console.warn('步骤不存在:', { stepId: id });
      return {
        code: 404,
        message: '步骤不存在'
      };
    }

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 步骤详情获取成功:`, {
      stepId: id,
      stepTitle: result.data.title,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '获取步骤详情成功',
      data: result.data
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 获取步骤详情失败:`, {
      stepId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });
    
    return {
      code: 500,
      message: '获取步骤详情失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 创建流程步骤
 */
async function createProcessStep(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { isAdmin } = data;

  console.log(`[${new Date().toISOString()}] 开始创建流程步骤:`, {
    openid: OPENID,
    stepTitle: data.title,
    isAdmin
  });

  // 权限检查 - 只有管理员可以创建流程步骤
  if (!isAdmin) {
    console.warn('创建流程步骤失败: 无管理员权限', { openid: OPENID });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  // 数据验证
  if (!data.title || !data.description) {
    console.warn('创建流程步骤失败: 必填字段缺失');
    return {
      code: 400,
      message: '步骤标题和描述不能为空'
    };
  }

  if (data.type === undefined || ![0, 1].includes(parseInt(data.type))) {
    console.warn('创建流程步骤失败: 流程类型无效', { type: data.type });
    return {
      code: 400,
      message: '流程类型必须为0(白事)或1(红事)'
    };
  }

  try {
    // 构建步骤数据
    const step = {
      title: data.title,
      description: data.description,
      content: data.content || '',
      type: parseInt(data.type),
      order: data.order || 1,
      imageUrl: data.imageUrl || '',
      productList: data.productList || [],
      status: data.status || 1,
      createTime: new Date(),
      updateTime: new Date(),
      creatorOpenid: OPENID
    };

    // 保存到数据库
    const result = await db.collection('processSteps').add({
      data: step
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 流程步骤创建成功:`, {
      stepId: result._id,
      stepTitle: data.title,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '创建流程步骤成功',
      data: {
        _id: result._id,
        ...step
      }
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 创建流程步骤失败:`, {
      stepTitle: data.title,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '创建流程步骤失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 更新流程步骤
 */
async function updateProcessStep(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin, ...updateData } = data;

  console.log(`[${new Date().toISOString()}] 开始更新流程步骤:`, {
    openid: OPENID,
    stepId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以更新流程步骤
  if (!isAdmin) {
    console.warn('更新流程步骤失败: 无管理员权限', { openid: OPENID, stepId: id });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  if (!id) {
    console.warn('更新流程步骤失败: 步骤ID为空');
    return {
      code: 400,
      message: '步骤ID不能为空'
    };
  }

  try {
    // 构建更新数据
    const updateFields = {
      ...updateData,
      updateTime: new Date(),
      updaterOpenid: OPENID
    };

    // 更新步骤
    await db.collection('processSteps').doc(id).update({
      data: updateFields
    });

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 流程步骤更新成功:`, {
      stepId: id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '更新流程步骤成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 更新流程步骤失败:`, {
      stepId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '更新流程步骤失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

/**
 * 删除流程步骤
 */
async function deleteProcessStep(data, context) {
  const { OPENID } = cloud.getWXContext();
  const startTime = Date.now();
  const { id, isAdmin } = data;

  console.log(`[${new Date().toISOString()}] 开始删除流程步骤:`, {
    openid: OPENID,
    stepId: id,
    isAdmin
  });

  // 权限检查 - 只有管理员可以删除流程步骤
  if (!isAdmin) {
    console.warn('删除流程步骤失败: 无管理员权限', { openid: OPENID, stepId: id });
    return {
      code: 403,
      message: '无权限执行此操作'
    };
  }

  if (!id) {
    console.warn('删除流程步骤失败: 步骤ID为空');
    return {
      code: 400,
      message: '步骤ID不能为空'
    };
  }

  try {
    // 删除步骤
    await db.collection('processSteps').doc(id).remove();

    const executionTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] 流程步骤删除成功:`, {
      stepId: id,
      executionTime: `${executionTime}ms`
    });

    return {
      code: 200,
      message: '删除流程步骤成功'
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] 删除流程步骤失败:`, {
      stepId: id,
      executionTime: `${executionTime}ms`,
      error: error.message,
      stack: error.stack
    });

    return {
      code: 500,
      message: '删除流程步骤失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}
