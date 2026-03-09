/**
 * 地址API模块
 * 提供地址管理相关的API接口封装
 */

const { call } = require('../utils/cloudFunction.js')

const FUNCTION_NAME = 'userDataManagement'

/**
 * 获取地址列表
 */
const getList = (options = {}) => {
  return call(FUNCTION_NAME, 'getAddressList', {}, {
    showLoading: true,
    loadingText: '加载中...',
    ...options
  })
}

/**
 * 添加地址
 */
const add = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'addAddress', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 更新地址
 */
const update = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'updateAddress', data, {
    showLoading: true,
    loadingText: '保存中...',
    ...options
  })
}

/**
 * 删除地址
 */
const remove = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'deleteAddress', data, {
    showLoading: true,
    loadingText: '删除中...',
    ...options
  })
}

/**
 * 设置默认地址
 */
const setDefault = (addressId, options = {}) => {
  return call(FUNCTION_NAME, 'setDefaultAddress', { addressId }, {
    showLoading: true,
    loadingText: '设置中...',
    ...options
  })
}

/**
 * 逆地理编码（云函数代理，前端不暴露地图 key）
 */
const reverseGeocodeLocation = (data = {}, options = {}) => {
  return call(FUNCTION_NAME, 'reverseGeocodeLocation', data, {
    showLoading: false,
    showError: false,
    ...options
  })
}

module.exports = {
  getList,
  add,
  update,
  remove,
  setDefault,
  reverseGeocodeLocation
}
