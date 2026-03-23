const { call } = require('../cloudFunction')

const adminApi = {
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
  adminApi
}
