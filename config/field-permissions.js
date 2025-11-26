/**
 * 字段级权限配置
 * 定义各集合的字段访问权限
 */

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
 * 用户角色
 */
const Roles = {
  GUEST: 'guest',        // 未登录用户
  USER: 'user',          // 普通用户
  ADMIN: 'admin'         // 管理员
}

/**
 * 脱敏类型
 */
const MaskType = {
  PHONE: 'phone',        // 手机号脱敏
  EMAIL: 'email',        // 邮箱脱敏
  NAME: 'name',          // 姓名脱敏
  ADDRESS: 'address',    // 地址脱敏
  IDCARD: 'idcard',      // 身份证脱敏
  OPENID: 'openid',      // OpenID脱敏
  BANKCARD: 'bankcard',  // 银行卡脱敏
  DEFAULT: 'default'     // 默认脱敏（保留前3后4）
}

/**
 * 集合字段权限配置
 * 
 * 配置结构说明：
 * - fields: 字段配置对象
 *   - access: 访问级别 (FieldAccess)
 *   - mask: 是否需要脱敏 (boolean)
 *   - maskType: 脱敏类型 (MaskType)
 * - ownerField: 标识所有者的字段名
 * - defaultAccess: 未配置字段的默认访问级别
 */
const CollectionPermissions = {
  /**
   * 订单集合权限配置
   */
  orders: {
    ownerField: 'userOpenid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      // 公开字段 - 所有人可见
      _id: { access: FieldAccess.PUBLIC },
      orderNo: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      updateTime: { access: FieldAccess.PUBLIC },
      
      // 用户可见字段 - 登录用户可见
      totalAmount: { access: FieldAccess.USER },
      deliveryType: { access: FieldAccess.USER },
      items: { access: FieldAccess.USER },
      
      // 所有者字段 - 仅所有者和管理员可见
      contactName: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.NAME 
      },
      contactPhone: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.PHONE 
      },
      address: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.ADDRESS 
      },
      serviceTime: { access: FieldAccess.OWNER },
      remark: { access: FieldAccess.OWNER },
      qrCodeUrl: { access: FieldAccess.OWNER },
      payTime: { access: FieldAccess.OWNER },
      completeTime: { access: FieldAccess.OWNER },
      processTime: { access: FieldAccess.OWNER },
      
      // 管理员字段 - 仅管理员可见
      userOpenid: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.OPENID 
      },
      userId: { access: FieldAccess.ADMIN },
      waitForBind: { access: FieldAccess.ADMIN },
      adminNote: { access: FieldAccess.ADMIN },
      
      // 隐藏字段 - 不返回
      _openid: { access: FieldAccess.HIDDEN }
    }
  },

  /**
   * 用户集合权限配置
   */
  users: {
    ownerField: 'openid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      // 公开字段
      _id: { access: FieldAccess.PUBLIC },
      nickname: { access: FieldAccess.PUBLIC },
      avatarUrl: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      
      // 所有者字段
      phone: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.PHONE 
      },
      email: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.EMAIL 
      },
      realName: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.NAME 
      },
      addresses: { access: FieldAccess.OWNER },
      
      // 管理员字段
      openid: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.OPENID 
      },
      unionid: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.OPENID 
      },
      isAdmin: { access: FieldAccess.ADMIN },
      lastLoginTime: { access: FieldAccess.ADMIN },
      loginCount: { access: FieldAccess.ADMIN }
    }
  },

  /**
   * 商品集合权限配置
   */
  products: {
    ownerField: null, // 商品没有所有者概念
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
      
      // 管理员字段
      cost: { access: FieldAccess.ADMIN },
      supplier: { access: FieldAccess.ADMIN },
      supplierContact: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.PHONE 
      },
      adminNote: { access: FieldAccess.ADMIN }
    }
  },

  /**
   * 分类集合权限配置
   */
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

  /**
   * 加工进度集合权限配置
   */
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
      
      // 所有者字段
      estimatedTime: { access: FieldAccess.OWNER },
      actualTime: { access: FieldAccess.OWNER },
      
      // 管理员字段
      userOpenid: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.OPENID 
      },
      operatorId: { access: FieldAccess.ADMIN },
      operatorNote: { access: FieldAccess.ADMIN }
    }
  },

  /**
   * 反馈集合权限配置
   */
  feedbacks: {
    ownerField: 'userOpenid',
    defaultAccess: FieldAccess.OWNER,
    fields: {
      _id: { access: FieldAccess.PUBLIC },
      type: { access: FieldAccess.PUBLIC },
      status: { access: FieldAccess.PUBLIC },
      createTime: { access: FieldAccess.PUBLIC },
      
      // 所有者字段
      content: { access: FieldAccess.OWNER },
      images: { access: FieldAccess.OWNER },
      contact: { 
        access: FieldAccess.OWNER, 
        mask: true, 
        maskType: MaskType.PHONE 
      },
      reply: { access: FieldAccess.OWNER },
      replyTime: { access: FieldAccess.OWNER },
      
      // 管理员字段
      userOpenid: { 
        access: FieldAccess.ADMIN, 
        mask: true, 
        maskType: MaskType.OPENID 
      },
      adminNote: { access: FieldAccess.ADMIN },
      handlerId: { access: FieldAccess.ADMIN }
    }
  }
}

/**
 * 获取集合的字段权限配置
 * @param {string} collectionName 集合名称
 * @returns {object|null} 权限配置
 */
const getCollectionPermissions = (collectionName) => {
  return CollectionPermissions[collectionName] || null
}

/**
 * 获取字段的权限配置
 * @param {string} collectionName 集合名称
 * @param {string} fieldName 字段名称
 * @returns {object} 字段权限配置
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
  
  // 返回默认权限
  return { access: collection.defaultAccess || FieldAccess.PUBLIC }
}

/**
 * 检查角色是否有权访问指定访问级别的字段
 * @param {string} role 用户角色 (Roles)
 * @param {string} accessLevel 访问级别 (FieldAccess)
 * @param {boolean} isOwner 是否是资源所有者
 * @returns {boolean} 是否有权访问
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
      // MASKED级别：所有人可见但需要脱敏，所有者和管理员看原始值
      return true
    case FieldAccess.HIDDEN:
      return false
    default:
      return false
  }
}

/**
 * 检查是否需要对字段进行脱敏
 * @param {string} role 用户角色
 * @param {object} fieldConfig 字段配置
 * @param {boolean} isOwner 是否是资源所有者
 * @returns {boolean} 是否需要脱敏
 */
const shouldMaskField = (role, fieldConfig, isOwner = false) => {
  if (!fieldConfig.mask) {
    return false
  }
  
  // 所有者和管理员不脱敏
  if (isOwner || role === Roles.ADMIN) {
    return false
  }
  
  return true
}

module.exports = {
  // 枚举
  FieldAccess,
  Roles,
  MaskType,
  
  // 配置
  CollectionPermissions,
  
  // 工具函数
  getCollectionPermissions,
  getFieldPermission,
  canAccessField,
  shouldMaskField
}