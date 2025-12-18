/**
 * 套餐API模块
 * 提供套餐相关的所有API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'packageManagement'

// 默认缓存时间(毫秒)
const DEFAULT_CACHE_TIME = 60000  // 1分钟

// ============ 用户端API ============

/**
 * 获取套餐列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.type - 套餐类型 (white/red)
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐列表
 */
const getList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getPackages', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    cache: options.cache !== false ? DEFAULT_CACHE_TIME : 0,
    ...options
  })
}

/**
 * 获取套餐详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐详情
 */
const getDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getPackageDetail', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 根据ID获取套餐
 * @param {string} id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐详情
 */
const getById = (id, options = {}) => {
  return getDetail({ id }, options)
}

/**
 * 按类型获取套餐列表
 * @param {string} type - 套餐类型 (white/red)
 * @param {Object} data - 其他查询参数
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐列表
 */
const getByType = (type, data = {}, options = {}) => {
  return getList({ ...data, type }, options)
}

// ============ 管理端API ============

/**
 * 管理员获取套餐列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.type - 套餐类型
 * @param {string} data.keyword - 搜索关键词
 * @param {number} data.status - 状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐列表
 */
const adminGetList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getPackages', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取套餐详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 套餐详情
 */
const adminGetDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getPackageDetail', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 创建套餐
 * @param {Object} data - 套餐数据
 * @param {string} data.name - 套餐名称
 * @param {string} data.description - 套餐描述
 * @param {string} data.type - 套餐类型 (white/red)
 * @param {number} data.price - 原价(分)
 * @param {number} data.discountPrice - 折扣价(分)
 * @param {string} data.imageUrl - 图片URL
 * @param {Array} data.template - 套餐模板
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 创建的套餐
 */
const create = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'createPackage', data, {
    showLoading: true,
    loadingText: '创建中...',
    ...options
  })
}

/**
 * 更新套餐
 * @param {Object} data - 套餐数据
 * @param {string} data.id - 套餐ID
 * @param {string} data.name - 套餐名称
 * @param {string} data.description - 套餐描述
 * @param {string} data.type - 套餐类型
 * @param {number} data.price - 原价(分)
 * @param {number} data.discountPrice - 折扣价(分)
 * @param {string} data.imageUrl - 图片URL
 * @param {Array} data.template - 套餐模板
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 更新后的套餐
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updatePackage', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 删除套餐
 * @param {Object} data - 参数
 * @param {string} data.id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'deletePackage', data, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
}

/**
 * 更新套餐状态
 * @param {Object} data - 参数
 * @param {string} data.id - 套餐ID
 * @param {number} data.status - 新状态 (0=下线, 1=上线)
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const updateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updatePackageStatus', data, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
}

/**
 * 上线套餐
 * @param {string} id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const publish = (id, options = {}) => {
  return updateStatus({ id, status: 1 }, options)
}

/**
 * 下线套餐
 * @param {string} id - 套餐ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const unpublish = (id, options = {}) => {
  return updateStatus({ id, status: 0 }, options)
}

// ============ 导出 ============

module.exports = {
  // 用户端
  getList,
  getDetail,
  getById,
  getByType,
  
  // 管理端
  adminGetList,
  adminGetDetail,
  create,
  update,
  remove,
  updateStatus,
  publish,
  unpublish,
  
  // 常量
  DEFAULT_CACHE_TIME
}