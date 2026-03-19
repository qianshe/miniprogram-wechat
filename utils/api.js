/**
 * 统一 API 封装层
 * 所有云函数调用统一走 cloudFunction.js 增强链路（缓存/loading/traceId）
 */

const { call } = require('./cloudFunction.js')

const priceToYuan = (price) => {
  return (parseFloat(price || 0) / 100).toFixed(2)
}

const stripCostFields = (product) => {
  if (!product || typeof product !== 'object') {
    return product
  }

  const { costPrice, originalPrice, ...rest } = product
  return rest
}

// 普通用户 API
const api = {
  // ============ 商品 ============
  getProducts: (params) => {
    return call('productManagement', 'getProducts', {
      status: 1,
      ...params
    }, { showError: false }).then((data) => ({
      ...data,
      records: Array.isArray(data?.records) ? data.records.map(stripCostFields) : []
    }))
  },

  getProductDetail: (id) => {
    return call('productManagement', 'getProductDetail', { id }).then(stripCostFields)
  },

  getProductsByIds: (ids) => {
    return call('productManagement', 'getProductsByIds', { ids })
  },

  getRecommendProducts: async (params) => {
    try {
      const data = await call('productManagement', 'getProducts', {
        page: 1,
        size: 6,
        status: 1,
        orderBy: 'createTime',
        orderDirection: 'desc',
        ...params
      }, { showError: false })
      return Array.isArray(data?.records) ? data.records.map(stripCostFields) : []
    } catch (err) {
      console.error('获取推荐商品失败:', err)
      return []
    }
  },

  // ============ 分类 ============
  getCategories: async (params) => {
    try {
      const data = await call('categoryManagement', 'getCategories', {
        type: params?.type,
        page: params?.page || 1,
        size: params?.size || 20,
        status: params?.status !== undefined ? params.status : 1,
        includeProductCount: params?.includeProductCount !== false
      }, { showError: false })
      return data.records
    } catch (err) {
      console.error('获取分类失败:', err)
      const mockCategories = [
        { id: 0, name: '白事用品', sort: 1, type: 'white' },
        { id: 1, name: '红事用品', sort: 2, type: 'red' }
      ]
      return mockCategories.filter(cat =>
        params?.type === undefined || cat.type === params.type
      )
    }
  },

  getCategoryDetail: async (id) => {
    try {
      return await call('categoryManagement', 'getCategoryDetail', {
        id,
        includeProductCount: true
      }, { showError: false })
    } catch (err) {
      console.error('获取分类详情失败:', err)
      return null
    }
  },

  // ============ 订单 ============
  createOrder: (data) => {
    return call('orderManagement', 'createOrder', data, { showLoading: true, loadingText: '提交中...' })
  },

  getOrderDetail: (orderNo, isAdmin = false) => {
    return call('orderManagement', 'getOrderDetail', { orderNo, isAdmin })
  },

  getUserOrders: (params) => {
    return call('orderManagement', 'getOrders', { ...params, isAdmin: false })
  },

  cancelOrder: (orderNo) => {
    return call('orderManagement', 'updateOrderStatus', {
      orderNo,
      status: 4,
      isAdmin: false
    }, { showLoading: true, loadingText: '取消中...' })
  },

  submitOfflineSettlementIntent: (data = {}) => {
    return call('orderManagement', 'submitOfflineSettlementIntent', {
      orderNo: data.orderNo,
      paymentNote: data.paymentNote,
      isAdmin: false
    })
  },

  payOrder: (orderNo) => {
    return call('orderManagement', 'submitOfflineSettlementIntent', {
      orderNo,
      isAdmin: false
    })
  },

  deleteOrder: (orderNo) => {
    return call('orderManagement', 'deleteOrder', {
      orderNo,
      isAdmin: false
    })
  },

  // ============ 流程 ============
  getProcessSteps: async (params) => {
    try {
      const data = await call('processManagement', 'getProcessSteps', params, { showError: false })
      return data.records
    } catch (err) {
      console.error('获取流程步骤失败:', err)
      return []
    }
  },

  getStepDetail: async (stepId) => {
    try {
      return await call('processManagement', 'getStepDetail', { id: stepId })
    } catch (err) {
      console.error('获取步骤详情失败:', err)
      return null
    }
  },

  // ============ 订单绑定 ============
  bindOrder: (orderNo, userId) => {
    return call('orderManagement', 'bindOrder', { orderNo, userId })
  },

  // ============ 订单预览（认领前）============
  getOrderPreview: (orderNo) => {
    return call('orderManagement', 'getOrderPreview', { orderNo })
  },

  // ============ 用户确认订单信息 ============
  updateOrderUserInfo: (orderNo, { contactName, contactPhone, serviceTime, address, remarks } = {}) => {
    return call('orderManagement', 'updateOrderUserInfo', { orderNo, contactName, contactPhone, serviceTime, address, remarks })
  },

  // ============ 登录 ============
  login: (userInfo) => {
    return call('login', 'userLogin', { userInfo }, { showError: false })
  },

  checkUser: () => {
    return call('login', 'checkUserExists', {}, { showError: false })
  },

  adminLogin: (account, password) => {
    return call('login', 'adminLogin', { account, password }, { showLoading: true, loadingText: '登录中...' })
  },

  // ============ 反馈 ============
  submitFeedback: async (data) => {
    const feedbackData = {
      content: data.content,
      contact: data.contact || '',
      images: data.images || [],
      createTime: new Date()
    }

    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      feedbackData.userId = userInfo.id || userInfo.openid
    }

    try {
      return await call('submitFeedback', 'create', feedbackData, { showLoading: true, loadingText: '提交中...' })
    } catch (cloudError) {
      console.warn('submitFeedback云函数不存在，使用本地模拟:', cloudError.message)
      return {
        code: 200,
        message: '反馈提交成功',
        data: { id: Date.now().toString(), ...feedbackData }
      }
    }
  },

  // ============ 用户信息（本地） ============
  getUserInfo: async () => {
    try {
      return wx.getStorageSync('userInfo') || null
    } catch (err) {
      console.error('获取用户信息失败:', err)
      return null
    }
  },

  clearUserInfo: async () => {
    try {
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('token')
      wx.removeStorageSync('isAdmin')
      return { success: true }
    } catch (err) {
      console.error('清除用户信息失败:', err)
      throw err
    }
  }
}

// 管理员 API
const adminApi = {
  // ============ 商品管理 ============
  getProducts: (params) => {
    return call('productManagement', 'getProducts', params)
  },

  getProductDetail: (id) => {
    return call('productManagement', 'getProductDetail', { id })
  },

  getProductsByIds: (ids) => {
    return call('productManagement', 'getProductsByIds', { ids })
  },

  createProduct: (data) => {
    return call('productManagement', 'createProduct', { ...data }, { showLoading: true, loadingText: '创建中...' })
  },

  updateProduct: (id, data) => {
    return call('productManagement', 'updateProduct', { id, ...data }, { showLoading: true, loadingText: '保存中...' })
  },

  deleteProduct: (id) => {
    return call('productManagement', 'deleteProduct', { id }, { showLoading: true, loadingText: '删除中...' })
  },

  updateStock: (productId, stock) => {
    return call('productManagement', 'updateStock', { id: productId, stock })
  },

  // ============ 分类管理 ============
  getCategories: (params) => {
    return call('categoryManagement', 'getCategories', {
      ...params,
      includeProductCount: true
    })
  },

  getCategoryDetail: (id) => {
    return call('categoryManagement', 'getCategoryDetail', {
      id,
      includeProductCount: true
    })
  },

  createCategory: (data) => {
    return call('categoryManagement', 'createCategory', { ...data }, { showLoading: true, loadingText: '创建中...' })
  },

  updateCategory: (id, data) => {
    return call('categoryManagement', 'updateCategory', { id, ...data }, { showLoading: true, loadingText: '保存中...' })
  },

  deleteCategory: (id) => {
    return call('categoryManagement', 'deleteCategory', { id }, { showLoading: true, loadingText: '删除中...' })
  },

  batchUpdateSort: (data) => {
    return call('categoryManagement', 'batchUpdateCategorySort', { ...data })
  },

  migrateCategories: () => {
    return call('categoryManagement', 'migrateCategories', {}, { showLoading: true, loadingText: '迁移中...' })
  },

  // ============ 用户管理 ============
  getUsers: (params = {}) => {
    return call('userManagement', 'getUsers', params, {
      showLoading: true,
      loadingText: '加载中...'
    })
  },

  getUserDetail: (id) => {
    return call('userManagement', 'getUserDetail', { id }, {
      showLoading: true
    })
  },

  setAdminRole: (id, isAdmin) => {
    return call('userManagement', 'setAdminRole', { id, isAdmin }, {
      showLoading: true,
      loadingText: isAdmin ? '设置中...' : '取消中...'
    })
  },

  updateUserStatus: (id, status) => {
    return call('userManagement', 'updateUserStatus', { id, status }, {
      showLoading: true,
      loadingText: status === 1 ? '启用中...' : '禁用中...'
    })
  },

  getUserCount: async () => {
    try {
      const res = await call('userManagement', 'getUsers', {
        page: 1,
        size: 1
      }, {
        showLoading: false
      })
      return res?.total || 0
    } catch (err) {
      console.error('[adminApi] 获取用户数失败:', err)
      return 0
    }
  },

  // ============ 订单管理 ============
  createOrder: (data) => {
    return call('orderManagement', 'createOrder', data, { showLoading: true, loadingText: '创建中...' })
  },

  getOrders: (params) => {
    return call('orderManagement', 'getOrders', { ...params })
  },

  getOrderDetail: (orderNo, isAdmin = false) => {
    return call('orderManagement', 'getOrderDetail', { orderNo, isAdmin })
  },

  updateOrderStatus: (orderNo, status) => {
    return call('orderManagement', 'updateOrderStatus', { orderNo, status }, { showLoading: true, loadingText: '更新中...' })
  },

  updateOrderFlowStatus: (orderId, orderStatus) => {
    return call('orderManagement', 'updateOrderFlowStatus', { orderId, orderStatus }, { showLoading: true, loadingText: '更新中...' })
  },

  updatePaymentStatus: (orderId, paymentStatus, paymentMethod = 'offline', paymentNote = '') => {
    return call('orderManagement', 'updatePaymentStatus', { orderId, paymentStatus, paymentMethod, paymentNote }, { showLoading: true, loadingText: '更新中...' })
  },

  updateOrderContent: (payload) => {
    return call('orderManagement', 'updateOrderContent', payload, { showLoading: true, loadingText: '保存中...' })
  },

  getStatistics: () => {
    return call('orderManagement', 'getStatistics', {})
  },

  // ============ 流程管理 ============
  getProcessSteps: (params) => {
    return call('processManagement', 'getProcessSteps', params)
  },

  getStepDetail: (id) => {
    return call('processManagement', 'getStepDetail', { id })
  },

  createProcessStep: (data) => {
    return call('processManagement', 'createProcessStep', { ...data }, { showLoading: true, loadingText: '创建中...' })
  },

  updateProcessStep: (id, data) => {
    return call('processManagement', 'updateProcessStep', { id, ...data }, { showLoading: true, loadingText: '保存中...' })
  },

  deleteProcessStep: (id) => {
    return call('processManagement', 'deleteProcessStep', { id }, { showLoading: true, loadingText: '删除中...' })
  }
}

module.exports = {
  api,
  adminApi,
  priceToYuan,
  callCloudFunction: call
}
