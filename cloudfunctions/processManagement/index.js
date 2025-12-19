/**
 * 流程管理云函数
 * 支持流程步骤查询、流程详情获取等功能
 */

const cloud = require('wx-server-sdk')
const { ErrorCodes, success, error, paramError, permissionError, notFoundError, dbError, wrapHandler } = require('./_shared/errorHandler')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 通过openid验证用户是否为管理员
 * @param {string} openid - 用户的openid
 * @returns {Promise<boolean>} - 是否为管理员
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
    console.error('[PROCESS] verifyAdminByOpenid error:', err);
    return false;
  }
}

/**
 * 检查集合是否存在
 */
async function checkCollectionExists(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
    return true
  } catch (err) {
    if (err.errCode === -502001 || err.message.includes('collection not exist')) {
      return false
    }
    throw err
  }
}

/**
 * 初始化数据库集合和默认数据
 */
async function initDatabase() {
  console.log('[PROCESS] Starting database initialization...')

  try {
    const collectionExists = await checkCollectionExists('processSteps')

    if (!collectionExists) {
      console.log('[PROCESS] processSteps collection not found, creating default data...')

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
      ]

      for (const step of defaultSteps) {
        await db.collection('processSteps').add({ data: step })
      }

      console.log(`[PROCESS] Database initialized with ${defaultSteps.length} default steps`)
    } else {
      console.log('[PROCESS] processSteps collection exists, skipping initialization')
    }

    return true
  } catch (err) {
    console.error('[PROCESS] Database initialization failed:', err)
    throw err
  }
}

/**
 * 获取流程步骤列表
 */
async function getProcessSteps(data) {
  const { type = 0, page = 1, size = 20 } = data || {}

  console.log('[PROCESS] getProcessSteps:', { type, page, size })

  try {
    await initDatabase()

    let query = db.collection('processSteps')
    const conditions = [{ type: parseInt(type) }]

    if (conditions.length > 0) {
      query = query.where(_.and(conditions))
    }

    query = query.orderBy('order', 'asc')

    const skip = (page - 1) * size
    query = query.skip(skip).limit(size)

    const result = await query.get()

    let countQuery = db.collection('processSteps')
    if (conditions.length > 0) {
      countQuery = countQuery.where(_.and(conditions))
    }
    const countResult = await countQuery.count()

    console.log('[PROCESS] getProcessSteps success:', {
      type,
      count: result.data.length,
      total: countResult.total
    })

    return success({
      records: result.data,
      total: countResult.total,
      page,
      size
    }, '获取流程步骤成功')
  } catch (err) {
    console.error('[PROCESS] getProcessSteps error:', err)
    return dbError('获取流程步骤失败', { error: err.message })
  }
}

/**
 * 获取流程步骤详情
 */
async function getStepDetail(data) {
  const { id } = data || {}

  console.log('[PROCESS] getStepDetail:', { id })

  if (!id) {
    return paramError('步骤ID不能为空')
  }

  try {
    let result
    try {
      result = await db.collection('processSteps').doc(id).get()
    } catch (docError) {
      console.log('[PROCESS] Doc query failed, trying alternative queries:', { id })

      const numericId = parseInt(id)
      if (!isNaN(numericId)) {
        const orderResult = await db.collection('processSteps')
          .where({ order: numericId })
          .limit(1)
          .get()

        if (orderResult.data && orderResult.data.length > 0) {
          result = { data: orderResult.data[0] }
        }
      }

      if (!result || !result.data) {
        const titleResult = await db.collection('processSteps')
          .where({ title: id })
          .limit(1)
          .get()

        if (titleResult.data && titleResult.data.length > 0) {
          result = { data: titleResult.data[0] }
        }
      }
    }

    if (!result || !result.data) {
      console.warn('[PROCESS] Step not found:', { id })
      return notFoundError('步骤不存在')
    }

    console.log('[PROCESS] getStepDetail success:', {
      id,
      title: result.data.title
    })

    return success(result.data, '获取步骤详情成功')
  } catch (err) {
    console.error('[PROCESS] getStepDetail error:', err)
    return dbError('获取步骤详情失败', { error: err.message })
  }
}

/**
 * 创建流程步骤
 */
async function createProcessStep(data) {
  const { OPENID } = cloud.getWXContext()
  const { isAdmin: _clientIsAdmin } = data || {}

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID)

  console.log('[PROCESS] createProcessStep:', {
    openid: OPENID,
    title: data?.title,
    isAdmin
  })

  if (!isAdmin) {
    console.warn('[PROCESS] createProcessStep denied: no admin permission')
    return permissionError('无权限执行此操作')
  }

  if (!data?.title || !data?.description) {
    return paramError('步骤标题和描述不能为空')
  }

  if (data.type === undefined || ![0, 1].includes(parseInt(data.type))) {
    return paramError('流程类型必须为0(白事)或1(红事)')
  }

  try {
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
    }

    const result = await db.collection('processSteps').add({
      data: step
    })

    console.log('[PROCESS] createProcessStep success:', {
      stepId: result._id,
      title: data.title
    })

    return success({
      _id: result._id,
      ...step
    }, '创建流程步骤成功')
  } catch (err) {
    console.error('[PROCESS] createProcessStep error:', err)
    return dbError('创建流程步骤失败', { error: err.message })
  }
}

/**
 * 更新流程步骤
 */
async function updateProcessStep(data) {
  const { OPENID } = cloud.getWXContext()
  const { id, isAdmin: _clientIsAdmin, ...updateData } = data || {}

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID)

  console.log('[PROCESS] updateProcessStep:', {
    openid: OPENID,
    stepId: id,
    isAdmin
  })

  if (!isAdmin) {
    console.warn('[PROCESS] updateProcessStep denied: no admin permission')
    return permissionError('无权限执行此操作')
  }

  if (!id) {
    return paramError('步骤ID不能为空')
  }

  try {
    const updateFields = {
      ...updateData,
      updateTime: new Date(),
      updaterOpenid: OPENID
    }

    await db.collection('processSteps').doc(id).update({
      data: updateFields
    })

    console.log('[PROCESS] updateProcessStep success:', { stepId: id })

    return success(null, '更新流程步骤成功')
  } catch (err) {
    console.error('[PROCESS] updateProcessStep error:', err)
    return dbError('更新流程步骤失败', { error: err.message })
  }
}

/**
 * 删除流程步骤
 */
async function deleteProcessStep(data) {
  const { OPENID } = cloud.getWXContext()
  const { id, isAdmin: _clientIsAdmin } = data || {}

  // 服务端验证管理员权限
  const isAdmin = await verifyAdminByOpenid(OPENID)

  console.log('[PROCESS] deleteProcessStep:', {
    openid: OPENID,
    stepId: id,
    isAdmin
  })

  if (!isAdmin) {
    console.warn('[PROCESS] deleteProcessStep denied: no admin permission')
    return permissionError('无权限执行此操作')
  }

  if (!id) {
    return paramError('步骤ID不能为空')
  }

  try {
    await db.collection('processSteps').doc(id).remove()

    console.log('[PROCESS] deleteProcessStep success:', { stepId: id })

    return success(null, '删除流程步骤成功')
  } catch (err) {
    console.error('[PROCESS] deleteProcessStep error:', err)
    return dbError('删除流程步骤失败', { error: err.message })
  }
}

/**
 * 主处理函数
 */
const handler = async (event, context) => {
  const { action, data } = event

  console.log('[PROCESS] Cloud function called:', {
    action,
    requestId: context.requestId,
    openid: cloud.getWXContext().OPENID
  })

  if (!action) {
    return paramError('缺少action参数')
  }

  switch (action) {
    case 'getProcessSteps':
      return await getProcessSteps(data)
    case 'getStepDetail':
      return await getStepDetail(data)
    case 'createProcessStep':
      return await createProcessStep(data)
    case 'updateProcessStep':
      return await updateProcessStep(data)
    case 'deleteProcessStep':
      return await deleteProcessStep(data)
    default:
      return error(ErrorCodes.PARAM_ERROR, `不支持的操作类型: ${action}`)
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'processManagement' })
