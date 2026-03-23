const { call } = require('../cloudFunction')
const { stripCostFields } = require('./helpers')

const api = {
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
      return mockCategories.filter((cat) => params?.type === undefined || cat.type === params.type)
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

  bindOrder: (orderNo, userId) => {
    return call('orderManagement', 'bindOrder', { orderNo, userId })
  },

  getOrderPreview: (orderNo) => {
    return call('orderManagement', 'getOrderPreview', { orderNo })
  },

  updateOrderUserInfo: (orderNo, { contactName, contactPhone, serviceTime, address, remarks } = {}) => {
    return call('orderManagement', 'updateOrderUserInfo', { orderNo, contactName, contactPhone, serviceTime, address, remarks })
  },

  login: (userInfo) => {
    return call('login', 'userLogin', { userInfo }, { showError: false })
  },

  checkUser: () => {
    return call('login', 'checkUserExists', {}, { showError: false })
  },

  adminLogin: (account, password) => {
    return call('login', 'adminLogin', { account, password }, { showLoading: true, loadingText: '登录中...' })
  },

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

module.exports = {
  api
}
