/**
 * 购物车API模块
 * 提供购物车云端同步相关的API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

const FUNCTION_NAME = 'userDataManagement'

/**
 * 获取云端购物车列表
 */
const getList = (options = {}) => {
  return call(FUNCTION_NAME, 'getCartList', {}, {
    showLoading: false,
    ...options
  })
}

/**
 * 同步购物车到云端
 */
const sync = (items = [], options = {}) => {
  return call(FUNCTION_NAME, 'syncCart', { items }, {
    showLoading: false,
    ...options
  })
}

/**
 * 添加商品到购物车
 */
const add = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'addToCart', data, {
    showLoading: false,
    ...options
  })
}

/**
 * 更新购物车项
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateCartItem', data, {
    showLoading: false,
    ...options
  })
}

/**
 * 从购物车移除
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'removeFromCart', data, {
    showLoading: false,
    ...options
  })
}

/**
 * 清空购物车
 */
const clear = (selectedOnly = false, options = {}) => {
  return call(FUNCTION_NAME, 'clearCart', { selectedOnly }, {
    showLoading: false,
    ...options
  })
}

module.exports = {
  getList,
  sync,
  add,
  update,
  remove,
  clear
}
