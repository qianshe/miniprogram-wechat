// API配置文件 - 已迁移到云函数，此文件仅保留必要配置
// 注意：大部分API已迁移到云函数调用，此配置主要用于向后兼容

const config = {
  // 基础配置（保留用于可能的HTTP请求）
  timeout: 10000,
  header: {
    'content-type': 'application/json'
  },

  // 云函数配置
  cloudFunctions: {
    // 商品管理云函数
    productManagement: 'productManagement',
    // 订单管理云函数
    orderManagement: 'orderManagement',
    // 流程管理云函数
    processManagement: 'processManagement'
  },

  // 废弃的API配置（仅用于错误提示）
  deprecated: {
    message: '此API配置已废弃，请使用云函数调用',
    migrationGuide: '请参考文档迁移到云函数调用方式'
  }
};

module.exports = config;
