// 云函数统一调用管理器
// 价格转换工具函数
const errorHandler = require('./errorHandler.js');
const priceToYuan = (price) => {
  return (parseFloat(price || 0) / 100).toFixed(2);
}

const priceToFen = (price) => {
  return Math.round(parseFloat(price || 0) * 100);
}

// 云函数调用封装
const callCloudFunction = async (functionName, action, data = {}, page = null) => {
  try {
    const result = await wx.cloud.callFunction({
      name: functionName,
      data: {
        action,
        data
      }
    });
    // 检查成功码 200 (HTTP OK)
    if (result.result.code === 200) {
      return result.result.data;
    } else {
      // 使用错误处理器处理业务错误
      const error = new Error(result.result.message || '云函数调用失败');
      error.code = result.result.code;
      error.functionName = functionName;
      error.action = action;

      if (page) {
        errorHandler.handleError(error, page);
      } else {
        console.error(`云函数调用失败 [${functionName}.${action}]:`, error);
      }

      throw error;
    }
  } catch (err) {
    console.error(`云函数调用失败 [${functionName}.${action}]:`, err);

    // 使用错误处理器处理系统错误
    if (page) {
      errorHandler.handleError(err, page);
    }

    throw err;
  }
};

/**
 * 获取用户openid（用于云函数权限验证）
 */
const getUserOpenId = async () => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'getOpenId',
      data: {}
    });
    return result.result.openid;
  } catch (error) {
    console.error('获取openid失败:', error);
    return null;
  }
};

// 普通用户API封装
const api = {
  // 商品相关 - 统一云函数调用
  getProducts: async (params) => {
    return await callCloudFunction('productManagement', 'getProducts', params);
  },

  getProductDetail: async (id) => {
    return await callCloudFunction('productManagement', 'getProductDetail', { id });
  },

  getProductsByIds: async (ids) => {
    return await callCloudFunction('productManagement', 'getProductsByIds', { ids });
  },

  getRecommendProducts: async (params) => {
    try {
      const data = await callCloudFunction('productManagement', 'getProducts', {
        page: 1,
        size: 6,
        status: 1,
        orderBy: 'createTime',
        orderDirection: 'desc',
        ...params
      });
      return data.records; // 返回商品列表
    } catch (err) {
      console.error('获取推荐商品失败:', err);
      return []; // 返回空数组避免页面崩溃
    }
  },
  
  getCategories: async (params) => {
    try {
      // 调用分类管理云函数获取分类列表
      const data = await callCloudFunction('categoryManagement', 'getCategories', {
        type: params?.type,
        page: params?.page || 1,
        size: params?.size || 20,
        status: params?.status !== undefined ? params.status : 1, // 默认只获取启用的分类
        includeProductCount: params?.includeProductCount !== false // 默认统计商品数
      });
      return data.records; // 返回分类列表
    } catch (err) {
      console.error('获取分类失败:', err);
      // 降级到模拟数据
      const mockCategories = [
        { id: 0, name: '白事用品', sort: 1, type: 'white' },
        { id: 1, name: '红事用品', sort: 2, type: 'red' }
      ];
      return mockCategories.filter(cat =>
        params?.type === undefined || cat.type === params.type
      );
    }
  },

  // 获取分类详情
  getCategoryDetail: async (id) => {
    try {
      return await callCloudFunction('categoryManagement', 'getCategoryDetail', { 
        id,
        includeProductCount: true 
      });
    } catch (err) {
      console.error('获取分类详情失败:', err);
      return null;
    }
  },

  // 购物车相关 - 使用本地存储
  getCartList: async () => {
    try {
      // 从本地存储获取购物车数据
      const cartList = wx.getStorageSync('cartList') || [];
      return cartList;
    } catch (err) {
      console.error('获取购物车失败:', err);
      return [];
    }
  },

  addToCart: async (data) => {
    try {
      // 使用本地存储管理购物车
      let cartList = wx.getStorageSync('cartList') || [];
      const existingIndex = cartList.findIndex(item => item.productId === data.productId);

      if (existingIndex > -1) {
        cartList[existingIndex].quantity += data.quantity || 1;
      } else {
        cartList.push({
          productId: data.productId,
          quantity: data.quantity || 1,
          addTime: new Date().toISOString()
        });
      }

      wx.setStorageSync('cartList', cartList);
      return { success: true };
    } catch (err) {
      console.error('添加购物车失败:', err);
      throw err;
    }
  },

  updateCart: async (data) => {
    try {
      let cartList = wx.getStorageSync('cartList') || [];
      const index = cartList.findIndex(item => item.productId === data.productId);
      if (index > -1) {
        cartList[index].quantity = data.quantity;
        wx.setStorageSync('cartList', cartList);
      }
      return { success: true };
    } catch (err) {
      console.error('更新购物车失败:', err);
      throw err;
    }
  },

  removeFromCart: async (productId) => {
    try {
      let cartList = wx.getStorageSync('cartList') || [];
      cartList = cartList.filter(item => item.productId !== productId);
      wx.setStorageSync('cartList', cartList);
      return { success: true };
    } catch (err) {
      console.error('删除购物车商品失败:', err);
      throw err;
    }
  },

  // 订单相关 - 统一云函数调用
  createOrder: async (data) => {
    return await callCloudFunction('orderManagement', 'createOrder', data);
  },

  getOrderDetail: async (orderNo, isAdmin = false) => {
    const result = await callCloudFunction('orderManagement', 'getOrderDetail', { orderNo, isAdmin });
    return result;
  },

  getUserOrders: async (params) => {
    return await callCloudFunction('orderManagement', 'getOrders', { ...params, isAdmin: false });
  },

  // 取消订单 - 调用云函数更新状态为已取消(4)
  cancelOrder: async (orderNo) => {
    return await callCloudFunction('orderManagement', 'updateOrderStatus', { 
      orderNo, 
      status: 4,  // CANCELLED
      isAdmin: false 
    });
  },

  // 支付订单 - 调用云函数更新状态为已支付(1)
  payOrder: async (orderNo) => {
    return await callCloudFunction('orderManagement', 'updateOrderStatus', { 
      orderNo, 
      status: 1,  // PAID
      isAdmin: false 
    });
  },

  // 删除订单 - 调用云函数删除订单
  deleteOrder: async (orderNo) => {
    return await callCloudFunction('orderManagement', 'deleteOrder', { 
      orderNo, 
      isAdmin: false 
    });
  },

  // 流程步骤 - 统一云函数调用
  getProcessSteps: async (params) => {
    try {
      const data = await callCloudFunction('processManagement', 'getProcessSteps', params);
      return data.records; // 返回步骤列表
    } catch (err) {
      console.error('获取流程步骤失败:', err);
      return [];
    }
  },

  getStepDetail: async (stepId) => {
    try {
      return await callCloudFunction('processManagement', 'getStepDetail', { id: stepId });
    } catch (err) {
      console.error('获取步骤详情失败:', err);
      return null;
    }
  },

  // 绑定订单 - 统一云函数调用
  bindOrder: async (orderNo, userId) => {
    return await callCloudFunction('orderManagement', 'bindOrder', { orderNo, userId });
  },

  // 用户登录 - 统一云函数调用
  login: async (userInfo) => {
    try {
      const result = await callCloudFunction('login', 'userLogin', { userInfo });
      return result;
    } catch (err) {
      console.error('登录云函数调用失败:', err);
      throw err;
    }
  },

  // 管理员登录 - 统一云函数调用
  adminLogin: async (account, password) => {
    try {
      const result = await callCloudFunction('login', 'adminLogin', { account, password });
      return result;
    } catch (err) {
      console.error('管理员登录云函数调用失败:', err);
      throw err;
    }
  },

  // 提交反馈 - 统一云函数调用
  submitFeedback: async (data) => {
    try {
      // 创建反馈数据
      const feedbackData = {
        content: data.content,
        contact: data.contact || '',
        images: data.images || [],
        createTime: new Date()
      };

      // 如果有用户登录信息，添加用户ID
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        feedbackData.userId = userInfo.id || userInfo.openid;
      }

      // 直接调用云函数（如果存在），否则模拟提交
      try {
        const result = await callCloudFunction('submitFeedback', 'create', feedbackData);
        return result;
      } catch (cloudError) {
        console.warn('submitFeedback云函数不存在，使用本地模拟:', cloudError.message);
        // 模拟提交成功
        return {
          code: 200,
          message: '反馈提交成功',
          data: {
            id: Date.now().toString(),
            ...feedbackData
          }
        };
      }
    } catch (err) {
      console.error('提交反馈失败:', err);
      throw err;
    }
  },

  // 获取用户信息
  getUserInfo: async () => {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        return userInfo;
      }
      return null;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      return null;
    }
  },

  // 清除用户信息
  clearUserInfo: async () => {
    try {
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      wx.removeStorageSync('isAdmin');
      return { success: true };
    } catch (err) {
      console.error('清除用户信息失败:', err);
      throw err;
    }
  }
}

// 管理员API封装 - 统一云函数调用
const adminApi = {
  // 商品管理
  getProducts: async (params) => {
    return await callCloudFunction('productManagement', 'getProducts', params);
  },

  getProductDetail: async (id) => {
    return await callCloudFunction('productManagement', 'getProductDetail', { id });
  },

  getProductsByIds: async (ids) => {
    return await callCloudFunction('productManagement', 'getProductsByIds', { ids });
  },

  createProduct: async (data) => {
    return await callCloudFunction('productManagement', 'createProduct', { ...data });
  },

  updateProduct: async (id, data) => {
    return await callCloudFunction('productManagement', 'updateProduct', { id, ...data });
  },

  deleteProduct: async (id) => {
    return await callCloudFunction('productManagement', 'deleteProduct', { id });
  },

  updateStock: async (productId, stock) => {
    return await callCloudFunction('productManagement', 'updateStock', { id: productId, stock });
  },

  // 分类管理 - 统一云函数调用
  getCategories: async (params) => {
    return await callCloudFunction('categoryManagement', 'getCategories', {
      ...params,
      includeProductCount: true
    });
  },

  getCategoryDetail: async (id) => {
    return await callCloudFunction('categoryManagement', 'getCategoryDetail', { 
      id, 
      includeProductCount: true 
    });
  },

  createCategory: async (data) => {
    return await callCloudFunction('categoryManagement', 'createCategory', { ...data });
  },

  updateCategory: async (id, data) => {
    return await callCloudFunction('categoryManagement', 'updateCategory', { id, ...data });
  },

  deleteCategory: async (id) => {
    return await callCloudFunction('categoryManagement', 'deleteCategory', { id });
  },

  // 批量更新分类排序
  batchUpdateSort: async (data) => {
    return await callCloudFunction('categoryManagement', 'batchUpdateCategorySort', { ...data });
  },

  // 分类数据迁移 - 将模拟数据迁移到数据库
  migrateCategories: async () => {
    return await callCloudFunction('categoryManagement', 'migrateCategories', {});
  },
  
  // 订单管理 - 统一云函数调用
  getOrders: async (params) => {
    return await callCloudFunction('orderManagement', 'getOrders', { ...params });
  },

  getOrderDetail: async (orderNo) => {
    return await callCloudFunction('orderManagement', 'getOrderDetail', { orderNo });
  },

  updateOrderStatus: async (orderNo, status) => {
    return await callCloudFunction('orderManagement', 'updateOrderStatus', { orderNo, status });
  },

  // 订单统计 - 暂未实现云函数版本
  getOrderStatistics: async () => {
    console.warn('adminApi.getOrderStatistics暂未实现云函数版本');
    throw new Error('此功能暂未实现');
  },

  // 流程管理 - 统一云函数调用
  getProcessSteps: async (params) => {
    return await callCloudFunction('processManagement', 'getProcessSteps', params);
  },

  getStepDetail: async (id) => {
    return await callCloudFunction('processManagement', 'getStepDetail', { id });
  },

  createProcessStep: async (data) => {
    return await callCloudFunction('processManagement', 'createProcessStep', { ...data });
  },

  updateProcessStep: async (id, data) => {
    return await callCloudFunction('processManagement', 'updateProcessStep', { id, ...data });
  },

  deleteProcessStep: async (id) => {
    return await callCloudFunction('processManagement', 'deleteProcessStep', { id });
  }
}

module.exports = {
  api,
  adminApi,
  priceToYuan,
  priceToFen,
  callCloudFunction  // 导出云函数调用管理器，供其他模块使用
};
