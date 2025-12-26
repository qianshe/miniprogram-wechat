const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} dateStr - 日期字符串或 Date 对象
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';

  // 如果是 ISO 字符串，直接截取日期部分
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }

  // 转换为 Date 对象
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param {string|Date} dateStr - 日期字符串或 Date 对象
 * @returns {string} 格式化后的日期时间字符串
 */
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';

  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

/**
 * 价格数值安全处理
 * 注意：云函数已统一将价格从"分"转换为"元"返回，此函数仅做数值安全处理
 * 数据契约：数据库存储"分"(整数)，云函数返回"元"(浮点数)，前端直接使用
 * @param {number} price - 价格（元，由云函数转换）
 * @returns {number|null} 安全的价格数值
 */
const normalizePrice = (price) => {
  if (price === null || price === undefined) return null;
  if (typeof price !== 'number') price = Number(price);
  if (!Number.isFinite(price)) return 0;
  return price;
}

/**
 * 格式化价格显示
 * @param {number} price - 价格（元）
 * @returns {string} 格式化后的价格字符串
 */
const formatPrice = (price) => {
  const normalized = normalizePrice(price);
  if (normalized === null) return null;
  return normalized.toFixed(2);
}

module.exports = {
  formatTime,
  formatDate,
  formatDateTime,
  normalizePrice,
  formatPrice
}
