/**
 * 分类API模块
 * 提供分类相关的所有API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'categoryManagement'

// 默认缓存时间(毫秒)
const DEFAULT_CACHE_TIME = 300000  // 5分钟（分类数据变化不频繁，可以缓存久一点）

// ============ 用户端API ============

/**
 * 获取分类列表（带缓存）
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类列表
 */
const getList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getCategories', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    cache: options.cache !== false ? DEFAULT_CACHE_TIME : 0,  // 默认启用缓存
    ...options
  })
}

/**
 * 获取分类树
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类树
 */
const getTree = (options = {}) => {
  return call(FUNCTION_NAME, 'getCategoryTree', {
    isAdmin: false
  }, {
    showLoading: false,
    cache: options.cache !== false ? DEFAULT_CACHE_TIME : 0,
    ...options
  })
}

/**
 * 获取分类详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类详情
 */
const getDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getCategoryDetail', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 根据ID获取分类
 * @param {string} id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类详情
 */
const getById = (id, options = {}) => {
  return getDetail({ id }, options)
}

/**
 * 获取子分类
 * @param {string} parentId - 父分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 子分类列表
 */
const getChildren = (parentId, options = {}) => {
  return call(FUNCTION_NAME, 'getChildCategories', {
    parentId,
    isAdmin: false
  }, {
    showLoading: false,
    cache: options.cache !== false ? DEFAULT_CACHE_TIME : 0,
    ...options
  })
}

// ============ 管理端API ============

/**
 * 管理员获取分类列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.keyword - 搜索关键词
 * @param {number} data.status - 状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类列表
 */
const adminGetList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getCategories', {
    ...data
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取分类树
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类树
 */
const adminGetTree = (options = {}) => {
  return call(FUNCTION_NAME, 'getCategoryTree', {}, {
    showLoading: false,
    ...options
  })
}

/**
 * 管理员获取分类详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 分类详情
 */
const adminGetDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getCategoryDetail', {
    ...data
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 创建分类
 * @param {Object} data - 分类数据
 * @param {string} data.name - 分类名称
 * @param {string} data.description - 分类描述
 * @param {string} data.parentId - 父分类ID
 * @param {number} data.sort - 排序
 * @param {string} data.icon - 图标
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 创建的分类
 */
const create = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'createCategory', data, {
    showLoading: true,
    loadingText: '创建中...',
    ...options
  })
}

/**
 * 更新分类
 * @param {Object} data - 分类数据
 * @param {string} data.id - 分类ID
 * @param {string} data.name - 分类名称
 * @param {string} data.description - 分类描述
 * @param {string} data.parentId - 父分类ID
 * @param {number} data.sort - 排序
 * @param {string} data.icon - 图标
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 更新后的分类
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateCategory', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 删除分类
 * @param {Object} data - 参数
 * @param {string} data.id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'deleteCategory', data, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
}

/**
 * 更新分类状态
 * @param {Object} data - 参数
 * @param {string} data.id - 分类ID
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const updateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateCategoryStatus', data, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
}

/**
 * 启用分类
 * @param {string} id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const enable = (id, options = {}) => {
  return updateStatus({ id, status: 1 }, options)
}

/**
 * 禁用分类
 * @param {string} id - 分类ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const disable = (id, options = {}) => {
  return updateStatus({ id, status: 0 }, options)
}

/**
 * 更新分类排序
 * @param {Object} data - 参数
 * @param {string} data.id - 分类ID
 * @param {number} data.sort - 新排序值
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const updateSort = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateCategorySort', data, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
}

/**
 * 批量更新分类排序
 * @param {Object} data - 参数
 * @param {Array<{id: string, sort: number}>} data.items - 排序项列表
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const batchUpdateSort = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'batchUpdateCategorySort', data, {
    showLoading: true,
    loadingText: '批量更新中...',
    ...options
  })
}

// ============ 导出 ============

module.exports = {
  // 用户端
  getList,
  getTree,
  getDetail,
  getById,
  getChildren,
  
  // 管理端
  adminGetList,
  adminGetTree,
  adminGetDetail,
  create,
  update,
  remove,
  updateStatus,
  enable,
  disable,
  updateSort,
  batchUpdateSort,
  
  // 常量
  DEFAULT_CACHE_TIME
}