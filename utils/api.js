const request = require('./request.js')
const apiConfig = require('../config/api.config.js')

// 价格转换：分转元
const priceToYuan = (price) => {
  return (parseFloat(price || 0) / 100).toFixed(2);
}

// 价格转换：元转分
const priceToFen = (price) => {
  return Math.round(parseFloat(price || 0) * 100);
}

// 通用响应处理
const handleResponse = (res) => {
  console.log('API Response:', res);
  
  if (!res || typeof res !== 'object') {
    throw new Error('无效的响应数据');
  }

  // 检查标准返回结构
  if (res.code !== 200) {
    const error = new Error(res.message || '操作失败');
    error.code = res.code;
    error.data = res.data;
    console.error('API Error:', error);
    throw error;
  }

  // 只返回data字段
  return res.data;
};

// 普通用户API封装
const api = {
  // 商品相关 - 云函数版本
  getProducts: async (params) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'getProducts',
          data: params
        }
      });

      if (result.result.code === 200) {
        const data = result.result.data;
        // 云函数已处理价格转换，直接返回
        return data;
      } else {
        throw new Error(result.result.message || '获取商品列表失败');
      }
    } catch (err) {
      console.error('获取商品列表失败:', err);
      throw err;
    }
  },

  getProductDetail: async (id) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'getProductDetail',
          data: { id }
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '获取商品详情失败');
      }
    } catch (err) {
      console.error('获取商品详情失败:', err);
      throw err;
    }
  },

  getRecommendProducts: async (params) => {
    try {
      // 使用商品查询云函数，添加推荐逻辑
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'getProducts',
          data: {
            page: 1,
            size: 6,
            status: 1,
            orderBy: 'createTime',
            orderDirection: 'desc',
            ...params
          }
        }
      });

      if (result.result.code === 200) {
        return result.result.data.records; // 云函数已处理价格转换
      } else {
        throw new Error(result.result.message || '获取推荐商品失败');
      }
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

  // 订单相关
  createOrder: (data) => {
    return request.post(apiConfig.api.orders, data).then(handleResponse)
  },
  
  getOrderDetail: (orderNo) => {
    const url = apiConfig.api.orderDetail.replace('{orderNo}', orderNo)
    return request.get(url).then(handleResponse)
  },
  
  getUserOrders: (userId, params) => {
    const url = apiConfig.api.orderList.replace('{userId}', userId)
    return request.get(url, params).then(handleResponse)
  },

  // 流程步骤 - 临时返回模拟数据
  getProcessSteps: async (params) => {
    try {
      // 暂时返回模拟数据，避免网络错误
      const mockSteps = [
        {
          id: 1,
          title: '选择服务',
          description: '选择红白事服务类型',
          order: 1,
          type: params?.type || 0
        },
        {
          id: 2,
          title: '选择商品',
          description: '选择所需商品和服务',
          order: 2,
          type: params?.type || 0
        },
        {
          id: 3,
          title: '确认订单',
          description: '确认订单信息和配送方式',
          order: 3,
          type: params?.type || 0
        }
      ];
      return mockSteps;
    } catch (err) {
      console.error('获取流程步骤失败:', err);
      return [];
    }
  },
  
  getStepDetail: async (stepId, params) => {
    try {
      // 暂时返回模拟数据，避免网络错误
      const mockStepDetail = {
        id: stepId,
        title: '步骤详情',
        description: '步骤详细描述',
        content: '步骤具体内容',
        productList: []
      };
      return mockStepDetail;
    } catch (err) {
      console.error('获取步骤详情失败:', err);
      return null;
    }
  },

  // 绑定订单
  bindOrder: (orderNo, userId) => {
    return request.post(apiConfig.api.bindOrder, { orderNo, userId })
      .then(handleResponse);
  }
}

// 管理员API封装 - 云函数版本
const adminApi = {
  // 商品管理
  getProducts: async (params) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'getProducts',
          data: params
        }
      });

      if (result.result.code === 200) {
        const data = result.result.data;
        // 云函数已处理价格转换，直接返回
        return data;
      } else {
        throw new Error(result.result.message || '获取商品列表失败');
      }
    } catch (err) {
      console.error('管理员获取商品列表失败:', err);
      throw err;
    }
  },

  getProductDetail: async (id) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'getProductDetail',
          data: { id }
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '获取商品详情失败');
      }
    } catch (err) {
      console.error('管理员获取商品详情失败:', err);
      throw err;
    }
  },

  createProduct: async (data) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'createProduct',
          data: data
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '创建商品失败');
      }
    } catch (err) {
      console.error('创建商品失败:', err);
      throw err;
    }
  },
  
  updateProduct: async (id, data) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'updateProduct',
          data: { id, ...data }
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '更新商品失败');
      }
    } catch (err) {
      console.error('更新商品失败:', err);
      throw err;
    }
  },

  deleteProduct: async (id) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'deleteProduct',
          data: { id }
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '删除商品失败');
      }
    } catch (err) {
      console.error('删除商品失败:', err);
      throw err;
    }
  },

  updateStock: async (productId, stock) => {
    try {
      const result = await wx.cloud.callFunction({
        name: 'productManagement',
        data: {
          action: 'updateStock',
          data: { id: productId, stock }
        }
      });

      if (result.result.code === 200) {
        return result.result.data;
      } else {
        throw new Error(result.result.message || '更新库存失败');
      }
    } catch (err) {
      console.error('更新库存失败:', err);
      throw err;
    }
  },
  
  // 订单管理
  getOrders: (params) => {
    return request.get(apiConfig.adminApi.orders, params).then(handleResponse);
  },
  
  getOrderDetail: (orderNo) => {
    const url = apiConfig.adminApi.orderDetail.replace('{orderNo}', orderNo);
    return request.get(url).then(handleResponse);
  },
  
  // 订单统计
  getOrderStatistics: (params) => {
    return request.get(apiConfig.adminApi.orderStatistics, params).then(handleResponse);
  },
  
  // 流程管理
  getProcessSteps: (params) => {
    return request.get(apiConfig.adminApi.processSteps, params).then(handleResponse);
  }
}

module.exports = {
  api,
  adminApi,
  priceToYuan,
  priceToFen
};
