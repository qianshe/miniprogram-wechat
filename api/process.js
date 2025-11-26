/**
 * 工序API模块
 * 提供工序相关的所有API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'processManagement'

// ============ 用户端API ============

/**
 * 获取订单工序列表
 * @param {Object} data - 查询参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序列表
 */
const getByOrder = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcessesByOrder', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 获取工序详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序详情
 */
const getDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcessDetail', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 根据ID获取工序
 * @param {string} id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序详情
 */
const getById = (id, options = {}) => {
  return getDetail({ id }, options)
}

/**
 * 获取工序进度
 * @param {Object} data - 查询参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序进度
 */
const getProgress = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getOrderProgress', data, {
    showLoading: false,
    ...options
  })
}

// ============ 管理端API ============

/**
 * 管理员获取工序列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.orderNo - 订单号
 * @param {number} data.status - 状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序列表
 */
const adminGetList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcesses', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取订单工序列表
 * @param {Object} data - 查询参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序列表
 */
const adminGetByOrder = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcessesByOrder', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取工序详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序详情
 */
const adminGetDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcessDetail', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 创建工序
 * @param {Object} data - 工序数据
 * @param {string} data.orderNo - 订单号
 * @param {string} data.name - 工序名称
 * @param {string} data.description - 工序描述
 * @param {number} data.sort - 排序
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 创建的工序
 */
const create = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'createProcess', data, {
    showLoading: true,
    loadingText: '创建中...',
    ...options
  })
}

/**
 * 更新工序
 * @param {Object} data - 工序数据
 * @param {string} data.id - 工序ID
 * @param {string} data.name - 工序名称
 * @param {string} data.description - 工序描述
 * @param {number} data.sort - 排序
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 更新后的工序
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateProcess', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 删除工序
 * @param {Object} data - 参数
 * @param {string} data.id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'deleteProcess', data, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
}

/**
 * 更新工序状态
 * @param {Object} data - 参数
 * @param {string} data.id - 工序ID
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const updateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateProcessStatus', data, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
}

/**
 * 开始工序
 * @param {string} id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const start = (id, options = {}) => {
  return updateStatus({ id, status: 1 }, options)  // IN_PROGRESS
}

/**
 * 完成工序
 * @param {string} id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const complete = (id, options = {}) => {
  return updateStatus({ id, status: 2 }, options)  // COMPLETED
}

/**
 * 暂停工序
 * @param {string} id - 工序ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const pause = (id, options = {}) => {
  return updateStatus({ id, status: 3 }, options)  // PAUSED
}

/**
 * 批量创建工序
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {Array<Object>} data.processes - 工序列表
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const batchCreate = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'batchCreateProcesses', data, {
    showLoading: true,
    loadingText: '批量创建中...',
    ...options
  })
}

/**
 * 批量更新工序状态
 * @param {Object} data - 参数
 * @param {Array<string>} data.ids - 工序ID列表
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const batchUpdateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'batchUpdateProcessStatus', data, {
    showLoading: true,
    loadingText: '批量更新中...',
    ...options
  })
}

/**
 * 获取工序模板列表
 * @param {Object} data - 查询参数
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 工序模板列表
 */
const getTemplates = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProcessTemplates', data, {
    showLoading: false,
    cache: 300000,  // 缓存5分钟
    ...options
  })
}

/**
 * 应用工序模板
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {string} data.templateId - 模板ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const applyTemplate = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'applyProcessTemplate', data, {
    showLoading: true,
    loadingText: '应用模板中...',
    ...options
  })
}

// ============ 导出 ============

module.exports = {
  // 用户端
  getByOrder,
  getDetail,
  getById,
  getProgress,
  
  // 管理端
  adminGetList,
  adminGetByOrder,
  adminGetDetail,
  create,
  update,
  remove,
  updateStatus,
  start,
  complete,
  pause,
  batchCreate,
  batchUpdateStatus,
  getTemplates,
  applyTemplate
}