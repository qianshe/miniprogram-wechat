/**
 * 前端字段访问控制工具
 * 用于在UI层面控制字段的显示
 * 与 config/field-permissions.js 配置保持一致
 */

const { ROLES, getCurrentRole, isAdmin } = require('./permission')

/**
 * 字段访问级别
 */
const FieldAccess = {
  PUBLIC: 'public',      // 所有人可见
  USER: 'user',          // 登录用户可见
  OWNER: 'owner',        // 仅所有者可见
  ADMIN: 'admin',        // 仅管理员可见
  MASKED: 'masked',      // 需要脱敏显示
  HIDDEN: 'hidden'       // 完全隐藏
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
 * 集合字段权限配置（前端副本）
 * 仅包含前端需要的配置信息
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
 * 获取当前用户的openid
 * @returns {string|null}
 */
const getCurrentUserId = () => {
  try {
    return wx.getStorageSync('openid') || null
  } catch (e) {
    console.error('获取用户ID失败:', e)
    return null
  }
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
 * 检查当前用户是否有权限查看字段
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @param {object} record 记录对象（用于判断所有权）
 * @returns {boolean} 是否有权限查看
 */
const canViewField = (collectionName, fieldName, record = null) => {
  const fieldConfig = getFieldPermission(collectionName, fieldName)
  const role = getCurrentRole()
  const userId = getCurrentUserId()
  
  // 检查是否是资源所有者
  let isOwner = false
  if (record) {
    const collection = getCollectionPermissions(collectionName)
    if (collection && collection.ownerField) {
      isOwner = record[collection.ownerField] === userId
    }
  }
  
  return checkFieldAccess(role, fieldConfig.access, isOwner)
}

/**
 * 检查角色是否有权访问字段
 * @param {string} role 用户角色
 * @param {string} accessLevel 访问级别
 * @param {boolean} isOwner 是否是所有者
 * @returns {boolean}
 */
const checkFieldAccess = (role, accessLevel, isOwner = false) => {
  switch (accessLevel) {
    case FieldAccess.PUBLIC:
      return true
    case FieldAccess.USER:
      return role === ROLES.USER || role === ROLES.ADMIN
    case FieldAccess.OWNER:
      return isOwner || role === ROLES.ADMIN
    case FieldAccess.ADMIN:
      return role === ROLES.ADMIN
    case FieldAccess.MASKED:
      return true
    case FieldAccess.HIDDEN:
      return false
    default:
      return false
  }
}

/**
 * 检查字段是否需要脱敏显示
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @param {object} record 记录对象
 * @returns {boolean}
 */
const shouldMaskField = (collectionName, fieldName, record = null) => {
  const fieldConfig = getFieldPermission(collectionName, fieldName)
  
  if (!fieldConfig.mask) {
    return false
  }
  
  // 管理员不脱敏
  if (isAdmin()) {
    return false
  }
  
  // 检查是否是所有者
  const userId = getCurrentUserId()
  const collection = getCollectionPermissions(collectionName)
  if (collection && collection.ownerField && record) {
    const isOwner = record[collection.ownerField] === userId
    if (isOwner) {
      return false // 所有者不脱敏
    }
  }
  
  return true
}

/**
 * 获取字段的脱敏类型
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @returns {string|null}
 */
const getFieldMaskType = (collectionName, fieldName) => {
  const fieldConfig = getFieldPermission(collectionName, fieldName)
  return fieldConfig.maskType || null
}

/**
 * 获取集合中用户可见的字段列表
 * @param {string} collectionName 集合名称
 * @param {object} record 记录对象（可选，用于判断所有权）
 * @returns {Array<string>} 可见字段名数组
 */
const getVisibleFields = (collectionName, record = null) => {
  const collection = getCollectionPermissions(collectionName)
  if (!collection) {
    return []
  }
  
  const visibleFields = []
  for (const [fieldName] of Object.entries(collection.fields)) {
    if (canViewField(collectionName, fieldName, record)) {
      visibleFields.push(fieldName)
    }
  }
  
  return visibleFields
}

/**
 * 获取集合中需要脱敏的字段列表
 * @param {string} collectionName 集合名称
 * @param {object} record 记录对象（可选）
 * @returns {Array<string>} 需要脱敏的字段名数组
 */
const getMaskedFields = (collectionName, record = null) => {
  const collection = getCollectionPermissions(collectionName)
  if (!collection) {
    return []
  }
  
  const maskedFields = []
  for (const [fieldName] of Object.entries(collection.fields)) {
    if (shouldMaskField(collectionName, fieldName, record)) {
      maskedFields.push(fieldName)
    }
  }
  
  return maskedFields
}

/**
 * 创建字段访问检查器
 * 预设集合名称，便于多次调用
 * @param {string} collectionName 集合名称
 * @returns {object} 检查器对象
 */
const createFieldAccessChecker = (collectionName) => {
  return {
    /**
     * 检查字段是否可见
     * @param {string} fieldName 字段名
     * @param {object} record 记录对象
     * @returns {boolean}
     */
    canView: (fieldName, record = null) => canViewField(collectionName, fieldName, record),
    
    /**
     * 检查字段是否需要脱敏
     * @param {string} fieldName 字段名
     * @param {object} record 记录对象
     * @returns {boolean}
     */
    shouldMask: (fieldName, record = null) => shouldMaskField(collectionName, fieldName, record),
    
    /**
     * 获取可见字段列表
     * @param {object} record 记录对象
     * @returns {Array<string>}
     */
    getVisible: (record = null) => getVisibleFields(collectionName, record),
    
    /**
     * 获取需要脱敏的字段列表
     * @param {object} record 记录对象
     * @returns {Array<string>}
     */
    getMasked: (record = null) => getMaskedFields(collectionName, record),
    
    /**
     * 获取字段脱敏类型
     * @param {string} fieldName 字段名
     * @returns {string|null}
     */
    getMaskType: (fieldName) => getFieldMaskType(collectionName, fieldName),
    
    /**
     * 获取字段权限配置
     * @param {string} fieldName 字段名
     * @returns {object}
     */
    getConfig: (fieldName) => getFieldPermission(collectionName, fieldName)
  }
}

/**
 * 在WXML中使用的简化检查函数
 * 用于wx:if等条件判断
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @param {object} record 记录对象
 * @returns {boolean}
 */
const checkField = (collectionName, fieldName, record = null) => {
  return canViewField(collectionName, fieldName, record)
}

/**
 * 批量检查多个字段的可见性
 * @param {string} collectionName 集合名称
 * @param {Array<string>} fieldNames 字段名数组
 * @param {object} record 记录对象
 * @returns {object} { fieldName: boolean } 映射
 */
const checkFieldsBatch = (collectionName, fieldNames, record = null) => {
  const result = {}
  for (const fieldName of fieldNames) {
    result[fieldName] = canViewField(collectionName, fieldName, record)
  }
  return result
}

/**
 * 获取字段访问级别的中文描述
 * @param {string} accessLevel 访问级别
 * @returns {string}
 */
const getAccessLevelLabel = (accessLevel) => {
  const labels = {
    [FieldAccess.PUBLIC]: '公开',
    [FieldAccess.USER]: '登录可见',
    [FieldAccess.OWNER]: '所有者可见',
    [FieldAccess.ADMIN]: '管理员可见',
    [FieldAccess.MASKED]: '脱敏显示',
    [FieldAccess.HIDDEN]: '隐藏'
  }
  return labels[accessLevel] || '未知'
}

module.exports = {
  // 枚举
  FieldAccess,
  MaskType,
  
  // 配置
  CollectionPermissions,
  
  // 配置获取
  getCollectionPermissions,
  getFieldPermission,
  getFieldMaskType,
  
  // 权限检查
  canViewField,
  checkFieldAccess,
  shouldMaskField,
  checkField,
  checkFieldsBatch,
  
  // 批量获取
  getVisibleFields,
  getMaskedFields,
  
  // 工厂函数
  createFieldAccessChecker,
  
  // 辅助函数
  getCurrentUserId,
  getAccessLevelLabel
}