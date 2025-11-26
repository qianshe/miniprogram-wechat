/**
 * API配置文件
 * 统一管理所有API端点和配置
 * 
 * 使用说明：
 * - 此配置文件整合了云函数调用配置、数据库集合名称、云存储路径等
 * - 通过引入 cloud.config.js 实现环境自动切换
 * - 建议在 utils/api.js 中引用此配置，保持命名统一
 */

// 引入云环境配置
const cloudConfig = require('./cloud.config')

/**
 * 获取当前运行环境
 * @returns {string} 'development' | 'production'
 */
const getEnvironment = () => {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const envVersion = accountInfo.miniProgram.envVersion
    // release 版本为生产环境，其他（develop/trial）为开发环境
    return envVersion === 'release' ? 'production' : 'development'
  } catch (error) {
    console.warn('[api.config] 获取运行环境失败，默认使用开发环境:', error.message)
    return 'development'
  }
}

// 当前环境标识
const ENV = getEnvironment()

// 是否为开发环境
const isDev = ENV === 'development'

/**
 * API配置对象
 */
const config = {
  // ============ 环境信息 ============
  // 当前环境标识
  env: ENV,
  // 是否为开发环境
  isDev: isDev,
  // 云环境ID（从 cloud.config.js 获取）
  envId: cloudConfig.envId,

  // ============ 云函数配置 ============
  // 云函数名称映射，便于统一管理和引用
  cloudFunction: {
    // 用户登录
    login: 'login',
    // 商品管理
    productManagement: 'productManagement',
    // 分类管理
    categoryManagement: 'categoryManagement',
    // 订单管理
    orderManagement: 'orderManagement',
    // 流程管理
    processManagement: 'processManagement'
  },

  // ============ 数据库集合名称 ============
  // 统一管理数据库集合名称，避免硬编码
  collections: {
    // 用户表
    users: 'users',
    // 商品表
    products: 'products',
    // 分类表
    categories: 'categories',
    // 订单表
    orders: 'orders',
    // 流程表
    processes: 'processes',
    // 地址表
    addresses: 'addresses',
    // 反馈表
    feedback: 'feedback',
    // 购物车表
    carts: 'carts',
    // 管理员表
    admins: 'admins'
  },

  // ============ 云存储路径配置 ============
  // 统一管理云存储文件路径前缀
  storage: {
    // 商品图片存储路径
    productImages: 'products/',
    // 分类图片存储路径
    categoryImages: 'categories/',
    // 用户头像存储路径
    userAvatars: 'avatars/',
    // 反馈图片存储路径
    feedbackImages: 'feedback/',
    // 临时文件存储路径
    temp: 'temp/'
  },

  // ============ 请求配置 ============
  // 默认请求超时（毫秒）- 保持向后兼容，单一数值
  timeout: 10000,

  // 详细超时配置（毫秒）
  timeouts: {
    // 默认请求超时
    default: 10000,
    // 文件上传超时
    upload: 60000,
    // 文件下载超时
    download: 30000,
    // 云函数调用超时
    cloudFunction: 15000
  },

  // HTTP请求头配置（用于可能的HTTP请求）
  header: {
    'content-type': 'application/json'
  },

  // ============ 分页配置 ============
  pagination: {
    // 默认每页数量
    defaultPageSize: 10,
    // 最大每页数量
    maxPageSize: 100,
    // 首页页码
    firstPage: 1
  },

  // ============ 业务配置 ============
  business: {
    // 商品状态：0-下架，1-上架
    productStatus: {
      offline: 0,
      online: 1
    },
    // 订单状态
    orderStatus: {
      pending: 0,      // 待处理
      confirmed: 1,    // 已确认
      processing: 2,   // 处理中
      completed: 3,    // 已完成
      cancelled: -1    // 已取消
    },
    // 系统类型
    systemType: {
      white: 'white',  // 白事
      red: 'red'       // 红事
    }
  },

  // ============ 向后兼容配置 ============
  // 保留旧的 cloudFunctions 命名以兼容现有代码
  cloudFunctions: {
    productManagement: 'productManagement',
    orderManagement: 'orderManagement',
    processManagement: 'processManagement',
    categoryManagement: 'categoryManagement',
    login: 'login'
  }
}

// ============ 辅助方法 ============
/**
 * 获取云函数名称
 * @param {string} key - 云函数键名
 * @returns {string} 云函数名称
 */
config.getCloudFunctionName = (key) => {
  return config.cloudFunction[key] || key
}

/**
 * 获取集合名称
 * @param {string} key - 集合键名
 * @returns {string} 集合名称
 */
config.getCollectionName = (key) => {
  return config.collections[key] || key
}

/**
 * 获取存储路径
 * @param {string} type - 存储类型
 * @param {string} filename - 文件名
 * @returns {string} 完整存储路径
 */
config.getStoragePath = (type, filename) => {
  const prefix = config.storage[type] || ''
  return prefix + (filename || '')
}

module.exports = config
