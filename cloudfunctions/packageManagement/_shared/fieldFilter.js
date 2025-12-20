/**
 * 云函数端字段过滤器模块
 * 根据用户角色和权限配置过滤返回字段
 * 与 sensitive.js 模块集成实现脱敏
 */

const sensitive = require('./sensitive')

/**
 * 字段访问级别（与 field-permissions.js 保持一致）
 */
const FieldAccess = {
  PUBLIC: 'public',
  USER: 'user',
  OWNER: 'owner',
  ADMIN: 'admin',
  MASKED: 'masked',
  HIDDEN: 'hidden'
}

/**
 * 用户角色
 */
const Roles = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin'
}

/**
 * 脱敏类型
 */
const MaskType = {
  PHONE: 'phone',
  EMAIL: 'email',
  NAME: 'name',
  ADDRESS: 'address',
  IDCARD: 'idcard',
  OPENID: 'openid',
  BANKCARD: 'bankcard',
  DEFAULT: 'default'
}

/**
 * 集合字段权限配置
 * 云函数端内置配置，与 config/field-permissions.js 保持同步
 */
const CollectionPermissions = {
  orders: {
    ownerField: 'userOpenid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      orderNo: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      updateTime: { access: FieldAccess.PUBLIC },
      totalAmount: { access: FieldAccess.USER },
      deliveryType: { access: FieldAccess.USER },
      items: { access: FieldAccess.USER },
      contactName: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.NAME },
      contactPhone: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.PHONE },
      address: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.ADDRESS },
      serviceTime: { access: FieldAccess.OWNER },
      remark: { access: FieldAccess.OWNER },
      qrCodeUrl: { access: FieldAccess.OWNER },
      payTime: { access: FieldAccess.OWNER },
      completeTime: { access: FieldAccess.OWNER },
      processTime: { access: FieldAccess.OWNER },
      userOpenid: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.OPENID },
      userId: { access: FieldAccess.ADMIN },
      waitForBind: { access: FieldAccess.ADMIN },
      adminNote: { access: FieldAccess.ADMIN },
      _openid: { access: FieldAccess.HIDDEN }
    }
  },
  users: {
    ownerField: 'openid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      nickname: { access: FieldAccess.PUBLIC },
      avatarUrl: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      phone: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.PHONE },
      email: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.EMAIL },
      realName: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.NAME },
      addresses: { access: FieldAccess.OWNER },
      openid: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.OPENID },
      unionid: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.OPENID },
      isAdmin: { access: FieldAccess.ADMIN },
      lastLoginTime: { access: FieldAccess.ADMIN },
      loginCount: { access: FieldAccess.ADMIN }
    }
  },
  products: {
    ownerField: null,
    defaultAccess: FieldAccess.PUBLIC,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      name: { access: FieldAccess.PUBLIC },
      description: { access: FieldAccess.PUBLIC },
      price: { access: FieldAccess.PUBLIC },
      originalPrice: { access: FieldAccess.PUBLIC },
      images: { access: FieldAccess.PUBLIC },
      category: { access: FieldAccess.PUBLIC },
      categoryId: { access: FieldAccess.PUBLIC },
      stock: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      updateTime: { access: FieldAccess.PUBLIC },
      cost: { access: FieldAccess.ADMIN },
      supplier: { access: FieldAccess.ADMIN },
      supplierContact: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.PHONE },
      adminNote: { access: FieldAccess.ADMIN }
    }
  },
  categories: {
    ownerField: null,
    defaultAccess: FieldAccess.PUBLIC,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      name: { access: FieldAccess.PUBLIC },
      description: { access: FieldAccess.PUBLIC },
      icon: { access: FieldAccess.PUBLIC },
      sort: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      updateTime: { access: FieldAccess.PUBLIC }
    }
  },
  processes: {
    ownerField: 'userOpenid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      orderNo: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      progress: { access: FieldAccess.PUBLIC },
      currentStep: { access: FieldAccess.PUBLIC },
      steps: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      updateTime: { access: FieldAccess.PUBLIC },
      estimatedTime: { access: FieldAccess.OWNER },
      actualTime: { access: FieldAccess.OWNER },
      userOpenid: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.OPENID },
      operatorId: { access: FieldAccess.ADMIN },
      operatorNote: { access: FieldAccess.ADMIN }
    }
  },
  feedbacks: {
    ownerField: 'userOpenid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      type: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      content: { access: FieldAccess.OWNER },
      images: { access: FieldAccess.OWNER },
      contact: { access: FieldAccess.OWNER, mask: true, maskType: MaskType.PHONE },
      reply: { access: FieldAccess.OWNER },
      replyTime: { access: FieldAccess.OWNER },
      userOpenid: { access: FieldAccess.ADMIN, mask: true, maskType: MaskType.OPENID },
      adminNote: { access: FieldAccess.ADMIN },
      handlerId: { access: FieldAccess.ADMIN }
    }
  }
}

/**
 * 根据脱敏类型执行脱敏
 * @param {string} value 原始值
 * @param {string} maskType 脱敏类型
 * @returns {string} 脱敏后的值
 */
const applyMask = (value, maskType) => {
  if (!value || typeof value !== 'string') return value
  
  switch (maskType) {
    case MaskType.PHONE:
      return sensitive.maskPhone(value)
    case MaskType.EMAIL:
      return sensitive.maskEmail(value)
    case MaskType.NAME:
      return sensitive.maskName(value)
    case MaskType.ADDRESS:
      return sensitive.maskAddress(value)
    case MaskType.IDCARD:
      return sensitive.maskIdCard(value)
    case MaskType.OPENID:
      return sensitive.maskOpenId(value)
    case MaskType.BANKCARD:
      return sensitive.maskBankCard(value)
    case MaskType.DEFAULT:
    default:
      return sensitive.mask(value, 3, 4)
  }
}

/**
 * 检查用户是否有权访问字段
 * @param {string} role 用户角色
 * @param {string} accessLevel 字段访问级别
 * @param {boolean} isOwner 是否是资源所有者
 * @returns {boolean}
 */
const canAccessField = (role, accessLevel, isOwner = false) => {
  switch (accessLevel) {
    case FieldAccess.PUBLIC:
      return true
    case FieldAccess.USER:
      return role === Roles.USER || role === Roles.ADMIN
    case FieldAccess.OWNER:
      return isOwner || role === Roles.ADMIN
    case FieldAccess.ADMIN:
      return role === Roles.ADMIN
    case FieldAccess.MASKED:
      return true
    case FieldAccess.HIDDEN:
      return false
    default:
      return false
  }
}

/**
 * 检查是否需要脱敏
 * @param {string} role 用户角色
 * @param {object} fieldConfig 字段配置
 * @param {boolean} isOwner 是否是资源所有者
 * @returns {boolean}
 */
const shouldMask = (role, fieldConfig, isOwner = false) => {
  if (!fieldConfig.mask) return false
  // 管理员不脱敏
  if (role === Roles.ADMIN) return false
  // 所有者不脱敏
  if (isOwner) return false
  return true
}

/**
 * 获取集合权限配置
 * @param {string} collectionName 集合名称
 * @returns {object|null}
 */
const getCollectionPermissions = (collectionName) => {
  return CollectionPermissions[collectionName] || null
}

/**
 * 获取字段权限配置
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @returns {object}
 */
const getFieldPermission = (collectionName, fieldName) => {
  const collection = CollectionPermissions[collectionName]
  if (!collection) {
    return { access: FieldAccess.PUBLIC }
  }
  
  const fieldConfig = collection.fields[fieldName]
  if (fieldConfig) {
    return fieldConfig
  }
  
  return { access: collection.defaultAccess || FieldAccess.PUBLIC }
}

/**
 * 过滤单条记录的字段
 * @param {object} record 原始记录
 * @param {string} collectionName 集合名称
 * @param {object} options 选项
 * @param {string} options.role 用户角色 ('guest' | 'user' | 'admin')
 * @param {string} options.userId 当前用户ID (openid)
 * @returns {object} 过滤后的记录
 */
const filterFields = (record, collectionName, options = {}) => {
  if (!record || typeof record !== 'object') return record
  
  const { role = Roles.GUEST, userId = null } = options
  const collectionConfig = getCollectionPermissions(collectionName)
  
  // 如果没有配置，返回原始记录
  if (!collectionConfig) return record
  
  // 判断是否是资源所有者
  const ownerField = collectionConfig.ownerField
  const isOwner = ownerField && record[ownerField] === userId
  
  const filtered = {}
  
  for (const [fieldName, fieldValue] of Object.entries(record)) {
    const fieldConfig = getFieldPermission(collectionName, fieldName)
    
    // 检查访问权限
    if (!canAccessField(role, fieldConfig.access, isOwner)) {
      continue // 跳过无权访问的字段
    }
    
    // 检查是否需要脱敏
    if (shouldMask(role, fieldConfig, isOwner)) {
      filtered[fieldName] = applyMask(fieldValue, fieldConfig.maskType)
    } else {
      filtered[fieldName] = fieldValue
    }
  }
  
  return filtered
}

/**
 * 过滤记录数组的字段
 * @param {Array} records 原始记录数组
 * @param {string} collectionName 集合名称
 * @param {object} options 选项
 * @param {string} options.role 用户角色
 * @param {string} options.userId 当前用户ID
 * @returns {Array} 过滤后的记录数组
 */
const filterFieldsArray = (records, collectionName, options = {}) => {
  if (!Array.isArray(records)) return records
  return records.map(record => filterFields(record, collectionName, options))
}

/**
 * 创建字段过滤器实例
 * 预设集合名称和用户信息，便于多次调用
 * @param {string} collectionName 集合名称
 * @param {object} options 选项
 * @returns {object} 过滤器对象
 */
const createFieldFilter = (collectionName, options = {}) => {
  return {
    /**
     * 过滤单条记录
     * @param {object} record 记录
     * @returns {object}
     */
    filter: (record) => filterFields(record, collectionName, options),
    
    /**
     * 过滤记录数组
     * @param {Array} records 记录数组
     * @returns {Array}
     */
    filterArray: (records) => filterFieldsArray(records, collectionName, options),
    
    /**
     * 更新选项
     * @param {object} newOptions 新选项
     */
    updateOptions: (newOptions) => {
      Object.assign(options, newOptions)
    },
    
    /**
     * 获取当前选项
     * @returns {object}
     */
    getOptions: () => ({ ...options })
  }
}

/**
 * 从云函数上下文获取用户角色
 * @param {object} event 云函数事件对象
 * @param {object} context 云函数上下文（可选）
 * @returns {string} 用户角色
 */
const getRoleFromEvent = (event, context = null) => {
  // 管理员标识
  if (event._isAdmin || event.isAdmin) {
    return Roles.ADMIN
  }
  
  // 检查是否有 openid（已登录）
  let openid = null
  if (context && context.wxContext) {
    openid = context.wxContext.OPENID
  } else if (event._identity) {
    openid = event._identity.openid
  }
  
  if (openid) {
    return Roles.USER
  }
  
  return Roles.GUEST
}

/**
 * 从云函数上下文获取用户ID
 * @param {object} event 云函数事件对象
 * @param {object} context 云函数上下文（可选）
 * @returns {string|null} 用户ID (openid)
 */
const getUserIdFromEvent = (event, context = null) => {
  // 优先从 context 获取
  if (context && context.wxContext && context.wxContext.OPENID) {
    return context.wxContext.OPENID
  }
  
  // 从 identity 获取
  if (event._identity && event._identity.openid) {
    return event._identity.openid
  }
  
  return null
}

/**
 * 便捷方法：从云函数事件创建过滤选项
 * @param {object} event 云函数事件对象
 * @param {object} context 云函数上下文
 * @returns {object} 过滤选项 { role, userId }
 */
const createFilterOptions = (event, context = null) => {
  return {
    role: getRoleFromEvent(event, context),
    userId: getUserIdFromEvent(event, context)
  }
}

/**
 * 便捷方法：从云函数参数直接过滤记录
 * @param {object|Array} data 记录或记录数组
 * @param {string} collectionName 集合名称
 * @param {object} event 云函数事件对象
 * @param {object} context 云函数上下文
 * @returns {object|Array} 过滤后的数据
 */
const filterFromEvent = (data, collectionName, event, context = null) => {
  const options = createFilterOptions(event, context)
  
  if (Array.isArray(data)) {
    return filterFieldsArray(data, collectionName, options)
  }
  return filterFields(data, collectionName, options)
}

module.exports = {
  // 枚举
  FieldAccess,
  Roles,
  MaskType,
  
  // 配置
  CollectionPermissions,
  
  // 核心过滤函数
  filterFields,
  filterFieldsArray,
  
  // 工厂函数
  createFieldFilter,
  
  // 辅助函数
  getCollectionPermissions,
  getFieldPermission,
  canAccessField,
  shouldMask,
  applyMask,
  
  // 云函数辅助
  getRoleFromEvent,
  getUserIdFromEvent,
  createFilterOptions,
  filterFromEvent
}