// HTTP请求工具 - 已大部分迁移到云函数，此文件仅保留必要功能
// 注意：建议使用云函数调用替代HTTP请求

const apiConfig = require('../config/api.config.js');

// 简化的请求函数（仅用于特殊情况）
const request = async (options = {}) => {
  console.warn('request工具已废弃，建议使用云函数调用');

  const { url, method = 'GET', data = {}, header = {} } = options;

  // 构建请求头
  const requestHeader = { ...apiConfig.header, ...header };

  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        data,
        header: requestHeader,
        timeout: apiConfig.timeout,
        success: resolve,
        fail: reject
      });
    });

    if (response.statusCode !== 200) {
      const error = new Error('HTTP请求失败');
      error.statusCode = response.statusCode;
      error.response = response.data;
      throw error;
    }

    return response.data;

  } catch (err) {
    console.error('HTTP请求异常:', err);
    throw err;
  }
};

// 便捷方法（已废弃，建议使用云函数）
const get = (url, params, options = {}) => {
  console.warn('request.get已废弃，建议使用云函数调用');
  const queryString = params ? Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&') : '';

  const fullUrl = queryString ? `${url}?${queryString}` : url;
  return request({ url: fullUrl, method: 'GET', ...options });
};

const post = (url, data, options = {}) => {
  console.warn('request.post已废弃，建议使用云函数调用');
  return request({ url, method: 'POST', data, ...options });
};

// 导出（保留向后兼容性）
module.exports = {
  request,
  get,
  post
};
