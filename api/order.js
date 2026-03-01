/**
 * 订单API模块
 * 提供订单相关的所有API接口封装
 */

const { call, invalidateOrderCache } = require('../utils/cloudFunction.js')

// 云函数名称
const FUNCTION_NAME = 'orderManagement'

// ============ 用户端API ============

/**
 * 获取用户订单列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {number} data.status - 订单状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 订单列表
 */
const getList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getOrders', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 获取订单详情
 * @param {Object} data - 查询参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 订单详情
 */
const getDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getOrderDetail', {
    ...data,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 创建订单
 * @param {Object} data - 订单数据
 * @param {Array} data.items - 订单商品列表
 * @param {string} data.addressId - 收货地址ID
 * @param {string} data.remark - 备注
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 创建的订单
 */
const create = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'createOrder', data, {
    showLoading: true,
    loadingText: '提交订单...',
    ...options
  })
  
  // 清除订单缓存
  invalidateOrderCache()
  
  return result
}

/**
 * 取消订单
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const cancel = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'updateOrderStatus', {
    orderNo: data.orderNo,
    status: 4,  // CANCELLED
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '取消中...',
    ...options
  })
  
  // 清除订单缓存
  invalidateOrderCache()
  
  return result
}

/**
 * 支付订单
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const pay = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'updateOrderStatus', {
    orderNo: data.orderNo,
    status: 1,  // PAID
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '支付中...',
    ...options
  })
  
  // 清除订单缓存
  invalidateOrderCache()
  
  return result
}

/**
 * 提交线下结算意向
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {string} [data.paymentNote] - 线下支付备注
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const submitOfflineSettlementIntent = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'submitOfflineSettlementIntent', {
    orderNo: data.orderNo,
    paymentNote: data.paymentNote,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '提交中...',
    ...options
  })

  // 清除订单缓存
  invalidateOrderCache()

  return result
}

/**
 * 删除订单
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const remove = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'deleteOrder', {
    orderNo: data.orderNo,
    isAdmin: false
  }, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
  
  // 清除订单缓存
  invalidateOrderCache()
  
  return result
}

/**
 * 绑定订单
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {string} data.userId - 用户ID
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const bind = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'bindOrder', data, {
    showLoading: true,
    loadingText: '绑定中...',
    ...options
  })
}

// ============ 管理端API ============

/**
 * 管理员获取订单列表
 * @param {Object} data - 查询参数
 * @param {number} data.page - 页码
 * @param {number} data.size - 每页数量
 * @param {number} data.status - 订单状态
 * @param {string} data.keyword - 搜索关键词
 * @param {string} data.startDate - 开始日期
 * @param {string} data.endDate - 结束日期
 * @param {number} data.minPrice - 最低价格
 * @param {number} data.maxPrice - 最高价格
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 订单列表
 */
const adminGetList = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getOrders', {
    ...data
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员获取订单详情
 * @param {Object} data - 查询参数
 * @param {string} data.orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 订单详情
 */
const adminGetDetail = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'getOrderDetail', {
    ...data
  }, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 管理员更新订单状态
 * @param {Object} data - 参数
 * @param {string} data.orderNo - 订单号
 * @param {number} data.status - 新状态
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 结果
 */
const adminUpdateStatus = async (data = {}, options = {}) => {
  const result = await call(FUNCTION_NAME, 'updateOrderStatus', {
    ...data
  }, {
    showLoading: true,
    loadingText: '更新中...',
    ...options
  })
  
  // 清除订单缓存
  invalidateOrderCache()
  
  return result
}

// ============ 便捷方法 ============

/**
 * 根据订单号获取详情
 * @param {string} orderNo - 订单号
 * @param {Object} options - 调用选项
 * @returns {Promise<Object>} 订单详情
 */
const getByOrderNo = (orderNo, options = {}) => {
  return getDetail({ orderNo }, options)
}

// ============ 导出 ============

module.exports = {
  // 用户端
  getList,
  getDetail,
  create,
  cancel,
  submitOfflineSettlementIntent,
  remove,
  bind,
  
  // 管理端
  adminGetList,
  adminGetDetail,
  adminUpdateStatus,
  
  // 便捷方法
  getByOrderNo
}
