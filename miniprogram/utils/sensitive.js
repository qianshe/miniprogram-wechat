/**
 * 敏感数据处理模块
 * 提供数据脱敏、安全日志输出等功能
 */

/**
 * 手机号脱敏
 * 输入: 13812345678
 * 输出: 138****5678
 * @param {string} phone 手机号
 * @returns {string} 脱敏后的手机号
 */
const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return ''
  if (phone.length < 7) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 身份证号脱敏
 * 输入: 110101199001011234
 * 输出: 110101********1234
 * @param {string} idCard 身份证号
 * @returns {string} 脱敏后的身份证号
 */
const maskIdCard = (idCard) => {
  if (!idCard || typeof idCard !== 'string') return ''
  if (idCard.length < 8) return idCard
  return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2')
}

/**
 * 姓名脱敏
 * 输入: 张三 -> 张*
 * 输入: 张三丰 -> 张*丰
 * @param {string} name 姓名
 * @returns {string} 脱敏后的姓名
 */
const maskName = (name) => {
  if (!name || typeof name !== 'string') return ''
  if (name.length === 1) return name
  if (name.length === 2) {
    return name[0] + '*'
  } else if (name.length > 2) {
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }
  return name
}

/**
 * 银行卡号脱敏
 * 输入: 6222021234567890123
 * 输出: 6222 **** **** 0123
 * @param {string} cardNo 银行卡号
 * @returns {string} 脱敏后的银行卡号
 */
const maskBankCard = (cardNo) => {
  if (!cardNo || typeof cardNo !== 'string') return ''
  if (cardNo.length < 8) return cardNo
  const first4 = cardNo.slice(0, 4)
  const last4 = cardNo.slice(-4)
  return `${first4} **** **** ${last4}`
}

/**
 * 邮箱脱敏
 * 输入: example@gmail.com
 * 输出: exa***@gmail.com
 * @param {string} email 邮箱地址
 * @returns {string} 脱敏后的邮箱
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return ''
  const atIndex = email.indexOf('@')
  if (atIndex < 0) return email
  const prefix = email.slice(0, atIndex)
  const suffix = email.slice(atIndex)
  if (prefix.length <= 3) {
    return prefix[0] + '***' + suffix
  }
  return prefix.slice(0, 3) + '***' + suffix
}

/**
 * 地址脱敏
 * 保留省市区，隐藏详细地址
 * @param {string} address 地址
 * @returns {string} 脱敏后的地址
 */
const maskAddress = (address) => {
  if (!address || typeof address !== 'string') return ''
  if (address.length <= 6) return address
  // 保留前6个字符（通常是省市区）
  return address.slice(0, 6) + '****'
}

/**
 * OpenID脱敏
 * 输入: oXXXX1234567890abcdef
 * 输出: oXXX****cdef
 * @param {string} openid OpenID
 * @returns {string} 脱敏后的OpenID
 */
const maskOpenId = (openid) => {
  if (!openid || typeof openid !== 'string') return ''
  if (openid.length <= 8) return openid
  return openid.slice(0, 4) + '****' + openid.slice(-4)
}

/**
 * 通用脱敏函数
 * @param {string} str 原始字符串
 * @param {number} prefixLen 保留前缀长度
 * @param {number} suffixLen 保留后缀长度
 * @param {string} maskChar 脱敏字符
 * @returns {string} 脱敏后的字符串
 */
const mask = (str, prefixLen = 3, suffixLen = 4, maskChar = '*') => {
  if (!str || typeof str !== 'string') return ''
  if (str.length <= prefixLen + suffixLen) return str
  const maskLen = str.length - prefixLen - suffixLen
  return str.slice(0, prefixLen) + maskChar.repeat(maskLen) + str.slice(-suffixLen)
}

/**
 * 敏感字段关键词列表
 */
const SENSITIVE_KEYS = [
  'phone', 'mobile', 'tel', 'telephone',
  'idcard', 'idCard', 'id_card', 'identityCard',
  'bankcard', 'bankCard', 'bank_card', 'cardNo', 'cardno',
  'password', 'pwd', 'pass', 'secret',
  'openid', 'openId', 'open_id',
  'unionid', 'unionId', 'union_id',
  'token', 'accessToken', 'access_token', 'refreshToken', 'refresh_token',
  'email', 'mail',
  'name', 'realName', 'real_name', 'userName', 'user_name',
  'address', 'addr',
  'key', 'apiKey', 'api_key', 'appKey', 'app_key', 'secretKey', 'secret_key'
]

/**
 * 检查字段名是否为敏感字段
 * @param {string} key 字段名
 * @returns {boolean} 是否为敏感字段
 */
const isSensitiveKey = (key) => {
  if (!key || typeof key !== 'string') return false
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEYS.some(k => lowerKey.includes(k.toLowerCase()))
}

/**
 * 根据字段名自动选择脱敏方式
 * @param {string} key 字段名
 * @param {string} value 字段值
 * @returns {string} 脱敏后的值
 */
const autoMask = (key, value) => {
  if (!value || typeof value !== 'string') return value
  
  const lowerKey = key.toLowerCase()
  
  // 手机号
  if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel')) {
    return maskPhone(value)
  }
  
  // 身份证
  if (lowerKey.includes('idcard') || lowerKey.includes('id_card') || lowerKey.includes('identity')) {
    return maskIdCard(value)
  }
  
  // 银行卡
  if (lowerKey.includes('bankcard') || lowerKey.includes('bank_card') || lowerKey.includes('cardno')) {
    return maskBankCard(value)
  }
  
  // 邮箱
  if (lowerKey.includes('email') || lowerKey.includes('mail')) {
    return maskEmail(value)
  }
  
  // 地址
  if (lowerKey.includes('address') || lowerKey.includes('addr')) {
    return maskAddress(value)
  }
  
  // OpenID/UnionID
  if (lowerKey.includes('openid') || lowerKey.includes('unionid')) {
    return maskOpenId(value)
  }
  
  // 姓名
  if (lowerKey.includes('name') && !lowerKey.includes('filename') && !lowerKey.includes('funcname')) {
    return maskName(value)
  }
  
  // 密码和密钥类：完全隐藏
  if (lowerKey.includes('password') || lowerKey.includes('pwd') || 
      lowerKey.includes('secret') || lowerKey.includes('token') || 
      lowerKey.includes('key')) {
    return '******'
  }
  
  // 默认通用脱敏
  return mask(value, 3, 4)
}

/**
 * 递归脱敏对象中的敏感字段
 * @param {any} obj 原始对象
 * @returns {any} 脱敏后的对象
 */
const maskObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj }
  
  for (const key in masked) {
    if (Object.prototype.hasOwnProperty.call(masked, key)) {
      if (isSensitiveKey(key)) {
        if (typeof masked[key] === 'string') {
          masked[key] = autoMask(key, masked[key])
        } else if (typeof masked[key] === 'object' && masked[key] !== null) {
          masked[key] = maskObject(masked[key])
        }
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = maskObject(masked[key])
      }
    }
  }
  
  return masked
}

/**
 * 安全日志输出
 * 自动检测并脱敏敏感数据
 * @param {string} prefix 日志前缀
 * @param {any} data 日志数据
 */
const safeLog = (prefix, data) => {
  try {
    if (data === undefined || data === null) {
      console.log(prefix)
      return
    }
    
    if (typeof data === 'object') {
      const maskedData = maskObject(data)
      console.log(prefix, JSON.stringify(maskedData))
    } else if (typeof data === 'string') {
      // 字符串直接输出，不做处理
      console.log(prefix, data)
    } else {
      console.log(prefix, data)
    }
  } catch (error) {
    console.log(prefix, '[SafeLog Error] Unable to process data')
  }
}

/**
 * 安全错误日志输出
 * @param {string} prefix 日志前缀
 * @param {Error|any} error 错误对象
 * @param {any} context 上下文数据（可选）
 */
const safeError = (prefix, error, context) => {
  try {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }
    
    if (context) {
      errorInfo.context = maskObject(context)
    }
    
    console.error(prefix, JSON.stringify(errorInfo))
  } catch (err) {
    console.error(prefix, '[SafeLog Error] Unable to process error')
  }
}

/**
 * 安全警告日志输出
 * @param {string} prefix 日志前缀
 * @param {any} data 日志数据
 */
const safeWarn = (prefix, data) => {
  try {
    if (data === undefined || data === null) {
      console.warn(prefix)
      return
    }
    
    if (typeof data === 'object') {
      const maskedData = maskObject(data)
      console.warn(prefix, JSON.stringify(maskedData))
    } else {
      console.warn(prefix, data)
    }
  } catch (error) {
    console.warn(prefix, '[SafeLog Error] Unable to process data')
  }
}

module.exports = {
  // 特定类型脱敏函数
  maskPhone,
  maskIdCard,
  maskName,
  maskBankCard,
  maskEmail,
  maskAddress,
  maskOpenId,
  
  // 通用脱敏函数
  mask,
  autoMask,
  maskObject,
  
  // 工具函数
  isSensitiveKey,
  SENSITIVE_KEYS,
  
  // 安全日志函数
  safeLog,
  safeError,
  safeWarn
}