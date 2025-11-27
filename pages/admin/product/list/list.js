const app = getApp();
const { adminApi } = require('../../../../utils/api.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    products: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    isLoading: false,
    keyword: '',
    showFilterPanel: false,
    filterParams: {
      priceMin: '',
      priceMax: '',
      categoryId: ''
    },
    categories: [],
    categoryOptions: [],
    selectedCategoryId: '',
    orderBy: 'createTime', // createTime, sales, price
    orderDirection: 'desc' // asc, desc
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCategories()
    this.loadProducts(true)
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.resetAndLoad()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore()
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载商品分类
   */
  loadCategories() {
    // 这里应该从API获取分类数据
    const categories = [
      { id: 1, name: '食品饮料' },
      { id: 2, name: '服装鞋包' },
      { id: 3, name: '美妆护肤' },
      { id: 4, name: '家居日用' },
      { id: 5, name: '数码电子' }
    ]

    // 转换为下拉菜单格式
    const categoryOptions = [
      { label: '全部分类', value: '' },
      ...categories.map(item => ({
        label: item.name,
        value: item.id
      }))
    ]

    this.setData({
      categories,
      categoryOptions
    })
  },

  /**
   * 加载商品列表
   */
  loadProducts(reset = false) {
    if (reset) {
      this.setData({
        page: 1,
        products: [],
        hasMore: true
      })
    }

    if (!this.data.hasMore || this.data.isLoading) {
      return
    }

    this.setData({
      isLoading: true
    })

    // 构建查询参数
    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize,
      keyword: this.data.keyword,
      orderBy: this.data.orderBy,
      orderDirection: this.data.orderDirection,
      categoryId: this.data.selectedCategoryId,
      ...this.data.filterParams
    }

    // 调用统一API获取商品数据
    adminApi.getProducts({
      page: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      orderBy: params.orderBy,
      orderDirection: params.orderDirection,
      ...params
    })
      .then(data => {
        const { records, total } = data;
        const hasMore = params.page * params.pageSize < total;
        const newPage = this.data.page + 1;

        // 处理字段映射 (兼容 _id/id 和 imageUrl/thumb)
        const processedRecords = records.map(item => ({
          ...item,
          id: item._id || item.id,  // 将 _id 映射为 id
          thumb: item.thumb || item.imageUrl || ''
        }));

        this.setData({
          products: reset ? processedRecords : [...this.data.products, ...processedRecords],
          page: newPage,
          hasMore,
          isLoading: false,
          total
        });
      })
      .catch(err => {
        console.error('获取商品列表失败:', err);
        // 失败时使用模拟数据作为后备
        const mockProducts = this.getMockProducts(params);
        const hasMore = mockProducts.length === this.data.pageSize;
        const newPage = this.data.page + 1;

        this.setData({
          products: reset ? mockProducts : [...this.data.products, ...mockProducts],
          page: newPage,
          hasMore,
          isLoading: false,
          total: 100 // 模拟总数
        });
      });
  },

  /**
   * 生成模拟商品数据
   */
  getMockProducts(params) {
    const products = []
    const startIndex = (params.page - 1) * params.pageSize
    const count = Math.min(params.pageSize, 10) // 模拟最多返回10条数据

    for (let i = 0; i < count; i++) {
      const id = startIndex + i + 1
      products.push({
        id,
        name: `商品 ${id}`,
        description: `这是商品 ${id} 的详细描述`,
        price: Math.floor(Math.random() * 1000) + 1,
        originalPrice: Math.floor(Math.random() * 2000) + 1000,
        thumb: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
        stock: Math.floor(Math.random() * 100),
        sales: Math.floor(Math.random() * 1000),
        status: Math.random() > 0.3 ? 1 : 0, // 1: 上架, 0: 下架
        categoryId: Math.ceil(Math.random() * 5),
        createTime: '2023-01-01 12:00:00'
      })
    }

    // 如果有关键词过滤
    if (params.keyword) {
      products = products.filter(item => item.name.includes(params.keyword))
    }

    // 如果有分类过滤
    if (params.categoryId) {
      products = products.filter(item => item.categoryId == params.categoryId)
    }

    // 如果有价格范围过滤
    if (params.priceMin) {
      products = products.filter(item => item.price >= parseFloat(params.priceMin))
    }
    if (params.priceMax) {
      products = products.filter(item => item.price <= parseFloat(params.priceMax))
    }

    return products
  },

  /**
   * 加载更多商品
   */
  loadMore() {
    this.loadProducts()
  },

  /**
   * 重置并重新加载
   */
  resetAndLoad() {
    this.loadProducts(true)
  },

  /**
   * TDesign搜索框变化
   */
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  /**
   * TDesign搜索框清空
   */
  onSearchClear() {
    this.setData({
      keyword: ''
    }, () => {
      this.resetAndLoad();
    });
  },

  onSearchConfirm() {
    this.resetAndLoad()
  },

  /**
   * 分类下拉框变化
   */
  onCategoryChange(e) {
    this.setData({
      selectedCategoryId: e.detail.value
    }, () => {
      this.resetAndLoad()
    })
  },

  /**
   * 排序方式改变
   */
  changeOrderBy(e) {
    const orderBy = e.currentTarget.dataset.orderby

    // 如果点击相同排序字段，切换排序方向
    if (this.data.orderBy === orderBy) {
      this.setData({
        orderDirection: this.data.orderDirection === 'asc' ? 'desc' : 'asc'
      })
    } else {
      // 如果点击不同排序字段，设置新的排序字段，默认为降序
      this.setData({
        orderBy,
        orderDirection: 'desc'
      })
    }

    this.resetAndLoad()
  },

  /**
   * 创建新商品
   */
  createProduct() {
    wx.navigateTo({
      url: '/pages/admin/product/edit/edit',
    })
  },

  /**
   * 编辑商品
   */
  editProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/product/edit/edit?id=${id}`,
    })
  },

  /**
   * 查看商品详情
   */
  viewProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}`,
    })
  },

  /**
   * 上架/下架商品
   */
  toggleProductStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 1 ? 0 : 1

    wx.showModal({
      title: '确认操作',
      content: newStatus === 1 ? '确定要上架该商品吗？' : '确定要下架该商品吗？',
      success: (res) => {
        if (res.confirm) {
          // 这里应该调用API更新商品状态
          // 模拟API请求
          setTimeout(() => {
            // 更新本地数据
            const products = this.data.products.map(item => {
              if (item.id === id) {
                return { ...item, status: newStatus }
              }
              return item
            })

            this.setData({
              products
            })

            wx.showToast({
              title: newStatus === 1 ? '上架成功' : '下架成功',
              icon: 'success'
            })
          }, 500)
        }
      }
    })
  },

  /**
   * 删除商品
   */
  async deleteProduct(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该商品吗？删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });

            // 调用统一API删除商品
            await adminApi.deleteProduct(id);

            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            // 重新加载商品列表
            this.loadProducts();
          } catch (error) {
            wx.hideLoading();
            console.error('删除商品失败:', error);
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    })
  },

  /**
   * 扫描商品
   */
  scanProduct() {
    wx.navigateTo({
      url: '/pages/admin/product/scan/scan'
    });
  }
})