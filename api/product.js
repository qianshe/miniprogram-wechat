/**
 * 产品API模块
 * 提供产品相关的所有API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'productManagement'

// 默认缓存时间(毫秒)
const DEFAULT_CACHE_TIME = 60000  // 1分钟

// ============ 用户端API ============

/**
 * 获取产品列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.categoryId - 分类ID
 * @param {string} data.keyword - 搜索关键词
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品列表
 */
const getList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProducts', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 获取产品详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品详情
 */
const getDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProductDetail', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 根据ID获取产品
 * @param {string} id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品详情
 */
const getById = (id, options = {}) => {
  return getDetail({ id }, options)
}

/**
 * 按分类获取产品列表
 * @param {string} categoryId - 分类ID
 * @param {Object} data - 其他查询参数
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品列表
 */
const getByCategory = (categoryId, data = {}, options = {}) => {
  return getList({ ...data, categoryId }, options)
}

/**
 * 搜索产品
 * @param {string} keyword - 搜索关键词
 * @param {Object} data - 其他查询参数
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 搜索结果
 */
const search = (keyword, data = {}, options = {}) => {
  return getList({ ...data, keyword }, options)
}

// ============ 管理端API ============

/**
 * 管理员获取产品列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {string} data.categoryId - 分类ID
 * @param {string} data.keyword - 搜索关键词
 * @param {number} data.status - 状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品列表
 */
const adminGetList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProducts', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取产品详情
 * @param {Object} data - 查询参数
 * @param {string} data.id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品详情
 */
const adminGetDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProductDetail', {
    ...data,
    isAdmin: true
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 创建产品
 * @param {Object} data - 产品数据
 * @param {string} data.name - 产品名称
 * @param {string} data.description - 产品描述
 * @param {number} data.price - 价格
 * @param {string} data.categoryId - 分类ID
 * @param {Array} data.images - 图片列表
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 创建的产品
 */
const create = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'createProduct', data, {
    showLoading: true,
    loadingText: '创建中...',
    ...options
  })
}

/**
 * 更新产品
 * @param {Object} data - 产品数据
 * @param {string} data.id - 产品ID
 * @param {string} data.name - 产品名称
 * @param {string} data.description - 产品描述
 * @param {number} data.price - 价格
 * @param {string} data.categoryId - 分类ID
 * @param {Array} data.images - 图片列表
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 更新后的产品
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateProduct', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 删除产品
 * @param {Object} data - 参数
 * @param {string} data.id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'deleteProduct', data, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
}

/**
 * 更新产品状态
 * @param {Object} data - 参数
 * @param {string} data.id - 产品ID
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const updateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateProductStatus', data, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
}

/**
 * 上架产品
 * @param {string} id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const publish = (id, options = {}) => {
  return updateStatus({ id, status: 1 }, options)
}

/**
 * 下架产品
 * @param {string} id - 产品ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const unpublish = (id, options = {}) => {
  return updateStatus({ id, status: 0 }, options)
}

/**
 * 批量更新产品状态
 * @param {Object} data - 参数
 * @param {Array<string>} data.ids - 产品ID列表
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const batchUpdateStatus = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'batchUpdateStatus', data, {
    showLoading: true,
    loadingText: '批量更新中...',
    ...options
  })
}

/**
 * 通过扫码获取产品信息
 * @param {Object} data - 参数
 * @param {string} data.code - 扫码内容
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 产品信息
 */
const getByQrCode = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getProductByQrCode', data, {
    showLoading: true,
    loadingText: '识别中...',
    ...options
  })
}

// ============ 导出 ============

module.exports = {
  // 用户端
  getList,
  getDetail,
  getById,
  getByCategory,
  search,
  
  // 管理端
  adminGetList,
  adminGetDetail,
  create,
  update,
  remove,
  updateStatus,
  publish,
  unpublish,
  batchUpdateStatus,
  getByQrCode
}