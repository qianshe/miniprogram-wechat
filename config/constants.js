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
  COMPLETED: 3,        // 已完成（已结清闭环）
  CANCELLED: 4,        // 已取消
  SERVED_UNPAID: 5     // 已服务未收款（先服务后付款场景）
};

/**
 * 订单状态文本映射
 */
const ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING_PAYMENT]: '待支付',
  [ORDER_STATUS.PAID]: '已支付',
  [ORDER_STATUS.PROCESSING]: '处理中',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消',
  [ORDER_STATUS.SERVED_UNPAID]: '待收款'
};

/**
 * 订单状态标签颜色
 */
const ORDER_STATUS_COLOR = {
  [ORDER_STATUS.PENDING_PAYMENT]: '#ff9800',
  [ORDER_STATUS.PAID]: '#4caf50',
  [ORDER_STATUS.PROCESSING]: '#2196f3',
  [ORDER_STATUS.COMPLETED]: '#9e9e9e',
  [ORDER_STATUS.CANCELLED]: '#f44336',
  [ORDER_STATUS.SERVED_UNPAID]: '#e91e63'  // 粉红色，表示待收款状态
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
  },
  [ORDER_STATUS.SERVED_UNPAID]: {
    text: '待收款',
    desc: '服务已完成，请尽快完成付款',
    class: 'served-unpaid'
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

// [殡葬平台转型] 全局冻结为 WHITE 类型，统一用于系统类型判断
const CURRENT_SYSTEM_TYPE = SYSTEM_TYPE.WHITE;

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

// ============ 订单流程状态（新双字段系统） ============

/**
 * 订单流程状态枚举（新系统）
 * 用于 orderStatus 字段，表示订单在业务流程中的状态
 */
const ORDER_FLOW_STATUS = {
  CREATED: 0,      // 已创建/待服务
  PROCESSING: 1,   // 处理中/服务中
  SERVICE_DONE: 2, // 服务完成
  COMPLETED: 3,    // 订单完成
  CANCELLED: 4     // 已取消
};

/**
 * 支付状态枚举（新系统）
 * 用于 paymentStatus 字段，表示订单的支付状态
 */
const PAYMENT_STATUS = {
  UNPAID: 0,  // 未支付
  PAID: 1     // 已支付
};

/**
 * 管理端订单Tab配置
 * 定义各Tab对应的 orderStatus 和 paymentStatus 组合
 */
const ADMIN_ORDER_TABS = [
  { index: '0', name: '全部', orderStatus: null, paymentStatus: null },
  { index: '1', name: '待沟通', orderStatus: 0, paymentStatus: 0 },   // CREATED + UNPAID
  { index: '2', name: '待服务', orderStatus: 0, paymentStatus: 1 },   // CREATED + PAID
  { index: '3', name: '服务中', orderStatus: 1, paymentStatus: null }, // PROCESSING
  { index: '4', name: '待尾款', orderStatus: 2, paymentStatus: 0 },   // SERVICE_DONE + UNPAID
  { index: '5', name: '已完成', orderStatus: 3, paymentStatus: null }, // COMPLETED
  { index: '6', name: '已取消', orderStatus: 4, paymentStatus: null }  // CANCELLED
];

/**
 * 根据 orderStatus 和 paymentStatus 获取对应的Tab索引
 * @param {number|string|null} orderStatus - 订单流程状态码
 * @param {number|string|null} paymentStatus - 支付状态码
 * @returns {string} Tab索引
 */
const getTabByStatusParams = (orderStatus, paymentStatus) => {
  const os = orderStatus !== undefined && orderStatus !== null ? parseInt(orderStatus) : null;
  const ps = paymentStatus !== undefined && paymentStatus !== null ? parseInt(paymentStatus) : null;
  
  const tab = ADMIN_ORDER_TABS.find(t => t.orderStatus === os && t.paymentStatus === ps);
  return tab ? tab.index : '0';
};

/**
 * 根据Tab索引获取对应的 orderStatus 和 paymentStatus
 * @param {string} tabIndex - Tab索引
 * @returns {Object} { orderStatus, paymentStatus }
 */
const getStatusByTabIndex = (tabIndex) => {
  const tab = ADMIN_ORDER_TABS.find(t => t.index === tabIndex);
  return tab ? { orderStatus: tab.orderStatus, paymentStatus: tab.paymentStatus } : { orderStatus: null, paymentStatus: null };
};

/**
 * 获取订单流程状态文本
 * @param {number} orderStatus - 订单流程状态码
 * @returns {string} 状态文本
 */
const getOrderFlowText = (orderStatus) => {
  const textMap = {
    [ORDER_FLOW_STATUS.CREATED]: '待服务',
    [ORDER_FLOW_STATUS.PROCESSING]: '服务中',
    [ORDER_FLOW_STATUS.SERVICE_DONE]: '服务完成',
    [ORDER_FLOW_STATUS.COMPLETED]: '已完成',
    [ORDER_FLOW_STATUS.CANCELLED]: '已取消'
  };
  return textMap[orderStatus] || '未知状态';
};

/**
 * 获取支付状态文本
 * @param {number} paymentStatus - 支付状态码
 * @returns {string} 状态文本
 */
const getPaymentStatusText = (paymentStatus) => {
  return paymentStatus === PAYMENT_STATUS.PAID ? '已收款' : '待收款确认';
};

/**
 * 是否显示支付状态标签
 * 取消订单只显示“已取消”，不再额外显示支付标签
 * @param {number} orderStatus - 订单流程状态码
 * @returns {boolean}
 */
const shouldShowPaymentStatusTag = (orderStatus) => {
  return orderStatus !== ORDER_FLOW_STATUS.CANCELLED;
};

/**
 * 获取支付状态标签显示文案
 * 用户端与管理端采用不同口径：
 * - 用户端：待付款 / 已付款
 * - 管理端：待收款确认 / 已收款
 * @param {number} orderStatus - 订单流程状态码
 * @param {number} paymentStatus - 支付状态码
 * @param {boolean} isAdmin - 是否管理员视角
 * @returns {string}
 */
const getPaymentStatusDisplayText = (orderStatus, paymentStatus, isAdmin = false) => {
  if (!shouldShowPaymentStatusTag(orderStatus)) {
    return '';
  }

  if (paymentStatus === PAYMENT_STATUS.PAID) {
    return isAdmin ? '已收款' : '已付款';
  }

  return isAdmin ? '待收款确认' : '待付款';
};

/**
 * 旧 status 到新字段的映射（用于数据迁移和兼容）
 * @param {number} status - 旧的订单状态码
 * @param {Date|null} payTime - 支付时间，用于判断是否已支付
 * @returns {Object} { orderStatus, paymentStatus }
 */
const mapLegacyStatusToNew = (status, payTime) => {
  const mapping = {
    0: { orderStatus: ORDER_FLOW_STATUS.CREATED, paymentStatus: PAYMENT_STATUS.UNPAID },
    1: { orderStatus: ORDER_FLOW_STATUS.CREATED, paymentStatus: PAYMENT_STATUS.PAID },
    2: { orderStatus: ORDER_FLOW_STATUS.PROCESSING, paymentStatus: payTime ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID },
    3: { orderStatus: ORDER_FLOW_STATUS.COMPLETED, paymentStatus: PAYMENT_STATUS.PAID },
    4: { orderStatus: ORDER_FLOW_STATUS.CANCELLED, paymentStatus: payTime ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID },
    5: { orderStatus: ORDER_FLOW_STATUS.SERVICE_DONE, paymentStatus: PAYMENT_STATUS.UNPAID }
  };
  return mapping[status] || { orderStatus: ORDER_FLOW_STATUS.CREATED, paymentStatus: PAYMENT_STATUS.UNPAID };
};

/**
 * 新字段到旧 status 的映射（用于兼容期双写）
 * @param {number} orderStatus - 订单流程状态码
 * @param {number} paymentStatus - 支付状态码
 * @returns {number} 旧的订单状态码
 */
const mapNewStatusToLegacy = (orderStatus, paymentStatus) => {
  if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) return 4;
  if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) return 3;
  if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE && paymentStatus === PAYMENT_STATUS.UNPAID) return 5;
  if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) return 2;
  if (orderStatus === ORDER_FLOW_STATUS.CREATED && paymentStatus === PAYMENT_STATUS.PAID) return 1;
  return 0; // CREATED + UNPAID
};

// ============ 导出 ============

module.exports = {
  // 订单（旧系统，兼容期保留）
  ORDER_STATUS,
  ORDER_STATUS_TEXT,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_INFO,
  getOrderStatusText,
  getOrderStatusColor,
  getOrderStatusInfo,
  // 订单流程状态（新系统）
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  getOrderFlowText,
  getPaymentStatusText,
  shouldShowPaymentStatusTag,
  getPaymentStatusDisplayText,
  mapLegacyStatusToNew,
  mapNewStatusToLegacy,
  // 管理端订单Tab配置
  ADMIN_ORDER_TABS,
  getTabByStatusParams,
  getStatusByTabIndex,
  // 用户
  USER_ROLE,
  USER_ROLE_TEXT,
  // 系统类型
  SYSTEM_TYPE,
  CURRENT_SYSTEM_TYPE,
  SYSTEM_TYPE_TEXT,
  SYSTEM_TYPE_COLOR,
  // 分页
  PAGINATION,
  // 响应码
  RESPONSE_CODE
};
