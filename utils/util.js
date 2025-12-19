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
 * 智能转换价格为"元"
 * 判断逻辑：如果价格 > 1000 且为整数或小数点后只有1-2位，认为是"分"，需要转换
 * @param {number} price - 价格（可能是"分"或"元"）
 * @returns {number} 价格（元）
 */
const normalizePrice = (price) => {
  if (price === null || price === undefined) return null;
  if (typeof price !== 'number') price = Number(price);
  if (isNaN(price)) return 0;
  
  // 如果价格 > 1000，认为是"分"，需要转换为"元"
  // 这个阈值基于：正常商品价格很少超过1000元，但以"分"存储时会超过100000
  if (price > 1000) {
    return price / 100;
  }
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
  normalizePrice,
  formatPrice
}
