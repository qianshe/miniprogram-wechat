const app = getApp()

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
   * 加载产品分类
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
    this.setData({
      categories
    })
  },

  /**
   * 加载产品列表
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
      ...this.data.filterParams
    }

    // 这里应该从API获取产品数据
    // 模拟API请求
    setTimeout(() => {
      // 模拟产品数据
      const mockProducts = this.getMockProducts(params)
      
      const hasMore = mockProducts.length === this.data.pageSize
      const newPage = this.data.page + 1

      this.setData({
        products: reset ? mockProducts : [...this.data.products, ...mockProducts],
        page: newPage,
        hasMore,
        isLoading: false,
        total: 100 // 模拟总数
      })
    }, 1000)
  },

  /**
   * 生成模拟产品数据
   */
  getMockProducts(params) {
    const products = []
    const startIndex = (params.page - 1) * params.pageSize
    const count = Math.min(params.pageSize, 10) // 模拟最多返回10条数据

    for (let i = 0; i < count; i++) {
      const id = startIndex + i + 1
      products.push({
        id,
        name: `产品 ${id}`,
        description: `这是产品 ${id} 的详细描述`,
        price: Math.floor(Math.random() * 1000) + 1,
        originalPrice: Math.floor(Math.random() * 2000) + 1000,
        thumb: 'https://img.yzcdn.cn/vant/cat.jpeg',
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
   * 加载更多产品
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
   * TDesign弹窗显示状态变化
   */
  onFilterPopupChange(e) {
    this.setData({
      showFilterPanel: e.detail.visible
    });
  },

  /**
   * 显示/隐藏筛选面板
   */
  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    })
  },

  /**
   * 设置筛选参数
   */
  onFilterPriceMinInput(e) {
    this.setData({
      'filterParams.priceMin': e.detail.value
    })
  },

  onFilterPriceMaxInput(e) {
    this.setData({
      'filterParams.priceMax': e.detail.value
    })
  },

  onCategoryChange(e) {
    this.setData({
      'filterParams.categoryId': e.currentTarget.dataset.id,
      selectedCategoryId: e.currentTarget.dataset.id
    })
  },

  /**
   * 应用筛选
   */
  applyFilter() {
    this.toggleFilterPanel()
    this.resetAndLoad()
  },

  /**
   * 重置筛选
   */
  resetFilter() {
    this.setData({
      filterParams: {
        priceMin: '',
        priceMax: '',
        categoryId: ''
      },
      selectedCategoryId: ''
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
   * 创建新产品
   */
  createProduct() {
    wx.navigateTo({
      url: '/pages/admin/product/create/create',
    })
  },

  /**
   * 编辑产品
   */
  editProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/product/edit/edit?id=${id}`,
    })
  },

  /**
   * 查看产品详情
   */
  viewProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}`,
    })
  },

  /**
   * 上架/下架产品
   */
  toggleProductStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 1 ? 0 : 1
    
    wx.showModal({
      title: '确认操作',
      content: newStatus === 1 ? '确定要上架该产品吗？' : '确定要下架该产品吗？',
      success: (res) => {
        if (res.confirm) {
          // 这里应该调用API更新产品状态
          // 模拟API请求
          setTimeout(() => {
            // 更新本地数据
            const products = this.data.products.map(item => {
              if (item.id === id) {
                return {...item, status: newStatus}
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
   * 删除产品
   */
  deleteProduct(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该产品吗？删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          // 这里应该调用API删除产品
          // 模拟API请求
          setTimeout(() => {
            // 更新本地数据
            const products = this.data.products.filter(item => item.id !== id)
            
            this.setData({
              products,
              total: this.data.total - 1
            })
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
          }, 500)
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