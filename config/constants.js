/**
 * 全局常量配置
 * 统一管理项目中的常量定义，避免重复定义
 */

// ============ 订单状态 ============

/**
 * 订单状态枚举
 */
const ORDER_STATUS = {
  PENDING_PAYMENT: 0,  // 待支付
  PAID: 1,             // 已支付
  PROCESSING: 2,       // 处理中
  COMPLETED: 3,        // 已完成
  CANCELLED: 4         // 已取消
};

/**
 * 订单状态文本映射
 */
const ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING_PAYMENT]: '待支付',
  [ORDER_STATUS.PAID]: '已支付',
  [ORDER_STATUS.PROCESSING]: '处理中',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消'
};

/**
 * 订单状态标签颜色
 */
const ORDER_STATUS_COLOR = {
  [ORDER_STATUS.PENDING_PAYMENT]: '#ff9800',
  [ORDER_STATUS.PAID]: '#4caf50',
  [ORDER_STATUS.PROCESSING]: '#2196f3',
  [ORDER_STATUS.COMPLETED]: '#9e9e9e',
  [ORDER_STATUS.CANCELLED]: '#f44336'
};

/**
 * 订单状态详细信息（包含文本、描述、样式类名）
 */
const ORDER_STATUS_INFO = {
  [ORDER_STATUS.PENDING_PAYMENT]: {
    text: '待支付',
    desc: '请尽快完成支付',
    class: 'pending'
  },
  [ORDER_STATUS.PAID]: {
    text: '已支付',
    desc: '我们将尽快为您安排服务',
    class: 'paid'
  },
  [ORDER_STATUS.PROCESSING]: {
    text: '处理中',
    desc: '服务进行中，请留意通知',
    class: 'processing'
  },
  [ORDER_STATUS.COMPLETED]: {
    text: '已完成',
    desc: '感谢您的信任',
    class: 'completed'
  },
  [ORDER_STATUS.CANCELLED]: {
    text: '已取消',
    desc: '订单已取消',
    class: 'cancelled'
  }
};

/**
 * 获取订单状态文本
 * @param {number} status - 状态码
 * @returns {string} 状态文本
 */
const getOrderStatusText = (status) => {
  return ORDER_STATUS_TEXT[Number(status)] || '未知状态';
};

/**
 * 获取订单状态颜色
 * @param {number} status - 状态码
 * @returns {string} 颜色值
 */
const getOrderStatusColor = (status) => {
  return ORDER_STATUS_COLOR[Number(status)] || '#999999';
};

/**
 * 获取订单状态详细信息
 * @param {number} status - 状态码
 * @returns {Object} { text, desc, class }
 */
const getOrderStatusInfo = (status) => {
  return ORDER_STATUS_INFO[Number(status)] || {
    text: '未知状态',
    desc: '',
    class: 'unknown'
  };
};

// ============ 用户角色 ============

const USER_ROLE = {
  USER: 0,      // 普通用户
  ADMIN: 1      // 管理员
};

const USER_ROLE_TEXT = {
  [USER_ROLE.USER]: '普通用户',
  [USER_ROLE.ADMIN]: '管理员'
};

// ============ 系统类型 ============

const SYSTEM_TYPE = {
  WHITE: 'white',  // 白事
  RED: 'red'       // 红事
};

const SYSTEM_TYPE_TEXT = {
  [SYSTEM_TYPE.WHITE]: '白事服务',
  [SYSTEM_TYPE.RED]: '红事服务'
};

const SYSTEM_TYPE_COLOR = {
  [SYSTEM_TYPE.WHITE]: '#333333',
  [SYSTEM_TYPE.RED]: '#d32f2f'
};

// ============ 分页默认值 ============

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 10,
  MAX_SIZE: 100
};

// ============ 响应码 ============

const RESPONSE_CODE = {
  SUCCESS: 200,
  SUCCESS_LEGACY: 0,  // 兼容旧版
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

// ============ 导出 ============

module.exports = {
  // 订单
  ORDER_STATUS,
  ORDER_STATUS_TEXT,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_INFO,
  getOrderStatusText,
  getOrderStatusColor,
  getOrderStatusInfo,
  // 用户
  USER_ROLE,
  USER_ROLE_TEXT,
  // 系统类型
  SYSTEM_TYPE,
  SYSTEM_TYPE_TEXT,
  SYSTEM_TYPE_COLOR,
  // 分页
  PAGINATION,
  // 响应码
  RESPONSE_CODE
};

