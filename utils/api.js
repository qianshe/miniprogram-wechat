// 云函数统一调用管理器
// 价格转换工具函数
const priceToYuan = (price) => {
  return (parseFloat(price || 0) / 100).toFixed(2);
}

const priceToFen = (price) => {
  return Math.round(parseFloat(price || 0) * 100);
}

// 云函数调用封装
const callCloudFunction = async (functionName, action, data = {}) => {
  try {
    const result = await wx.cloud.callFunction({
      name: functionName,
      data: {
        action,
        data
      }
    });

    if (result.result.code === 200) {
      return result.result.data;
    } else {
      throw new Error(result.result.message || '云函数调用失败');
    }
  } catch (err) {
    console.error(`云函数调用失败 [${functionName}.${action}]:`, err);
    throw err;
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
      // 暂时返回模拟分类数据
      const mockCategories = [
        { id: 0, name: '白事用品', sort: 1 },
        { id: 1, name: '红事用品', sort: 2 }
      ];
      return mockCategories.filter(cat =>
        params?.type === undefined || cat.id === params.type
      );
    } catch (err) {
      console.error('获取分类失败:', err);
      return [];
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
    console.log('[API] 调用getOrderDetail:', { orderNo, isAdmin });
    const result = await callCloudFunction('orderManagement', 'getOrderDetail', { orderNo, isAdmin });
    console.log('[API] getOrderDetail返回结果:', result);
    return result;
  },

  getUserOrders: async (params) => {
    return await callCloudFunction('orderManagement', 'getOrders', { ...params, isAdmin: false });
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
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: { userInfo }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '登录失败');
      }
    } catch (err) {
      console.error('登录云函数调用失败:', err);
      throw err;
    }
  },

  // 提交反馈 - 统一云函数调用
  submitFeedback: async (data) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data
      });

      if (result.result && result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result?.message || '提交反馈失败');
      }
    } catch (err) {
      console.error('提交反馈云函数调用失败:', err);
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

  createProduct: async (data) => {
    return await callCloudFunction('productManagement', 'createProduct', { ...data, isAdmin: true });
  },

  updateProduct: async (id, data) => {
    return await callCloudFunction('productManagement', 'updateProduct', { id, ...data, isAdmin: true });
  },

  deleteProduct: async (id) => {
    return await callCloudFunction('productManagement', 'deleteProduct', { id, isAdmin: true });
  },

  updateStock: async (productId, stock) => {
    return await callCloudFunction('productManagement', 'updateStock', { id: productId, stock, isAdmin: true });
  },
  
  // 订单管理 - 统一云函数调用
  getOrders: async (params) => {
    return await callCloudFunction('orderManagement', 'getOrders', { ...params, isAdmin: true });
  },

  getOrderDetail: async (orderNo) => {
    return await callCloudFunction('orderManagement', 'getOrderDetail', { orderNo, isAdmin: true });
  },

  updateOrderStatus: async (orderNo, status) => {
    return await callCloudFunction('orderManagement', 'updateOrderStatus', { orderNo, status, isAdmin: true });
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
    return await callCloudFunction('processManagement', 'createProcessStep', { ...data, isAdmin: true });
  },

  updateProcessStep: async (id, data) => {
    return await callCloudFunction('processManagement', 'updateProcessStep', { id, ...data, isAdmin: true });
  },

  deleteProcessStep: async (id) => {
    return await callCloudFunction('processManagement', 'deleteProcessStep', { id, isAdmin: true });
  }
}

module.exports = {
  api,
  adminApi,
  priceToYuan,
  priceToFen,
  callCloudFunction  // 导出云函数调用管理器，供其他模块使用
};
