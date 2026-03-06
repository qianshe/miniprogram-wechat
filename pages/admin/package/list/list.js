const packageApi = require('../../../../api/package.js')
const { checkAdminAccess } = require('../../../../utils/adminGuard.js')

Page({
  /**
   * 页面的初始数据
   */
  data: {
    packages: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    isLoading: false,
    keyword: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!checkAdminAccess()) return;
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadPackages(true)
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
   * 加载套餐列表
   */
  async loadPackages(reset = false) {
    if (reset) {
      this.setData({
        page: 1,
        packages: [],
        hasMore: true
      })
    }

    if (!this.data.hasMore || this.data.isLoading) {
      return
    }

    this.setData({ isLoading: true })

    try {
      const params = {
        page: this.data.page,
        size: this.data.pageSize,
        keyword: this.data.keyword,
        type: 'white' // 默认只查询白事套餐
      }

      const result = await packageApi.adminGetList(params, { showLoading: false })
      const { records = [], total = 0 } = result

      const hasMore = this.data.page * this.data.pageSize < total
      const newPage = this.data.page + 1

      // 处理数据
      // 注意：云函数已将价格从"分"转换为"元"，无需再次转换
      const processedRecords = records.map(item => ({
        ...item,
        id: item._id || item.id,
        // 格式化价格显示（云函数返回的已是"元"）
        priceDisplay: (item.price || 0).toFixed(2),
        discountPriceDisplay: item.discountPrice ? item.discountPrice.toFixed(2) : null
      }))

      this.setData({
        packages: reset ? processedRecords : [...this.data.packages, ...processedRecords],
        page: newPage,
        hasMore,
        isLoading: false,
        total
      })
    } catch (error) {
      console.error('加载套餐列表失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ isLoading: false })
    }
  },

  /**
   * 加载更多
   */
  loadMore() {
    this.loadPackages()
  },

  /**
   * 重置并重新加载
   */
  resetAndLoad() {
    this.loadPackages(true)
  },

  /**
   * 搜索框输入
   */
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  /**
   * 搜索框清空
   */
  onSearchClear() {
    this.setData({ keyword: '' }, () => {
      this.resetAndLoad()
    })
  },

  /**
   * 搜索确认
   */
  onSearchConfirm() {
    this.resetAndLoad()
  },

  /**
   * 创建新套餐
   */
  createPackage() {
    wx.navigateTo({
      url: '/pages/admin/package/edit/edit'
    })
  },

  /**
   * 编辑套餐
   */
  editPackage(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/package/edit/edit?id=${id}`
    })
  },

  /**
   * 切换套餐状态
   */
  async togglePackageStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 1 ? 0 : 1

    wx.showModal({
      title: '确认操作',
      content: newStatus === 1 ? '确定要上线该套餐吗?' : '确定要下线该套餐吗?',
      success: async (res) => {
        if (res.confirm) {
          try {
            await packageApi.updateStatus({ id, status: newStatus })
            
            // 更新本地数据
            const packages = this.data.packages.map(item => {
              if (item.id === id || item._id === id) {
                return { ...item, status: newStatus }
              }
              return item
            })

            this.setData({ packages })

            wx.showToast({
              title: newStatus === 1 ? '上线成功' : '下线成功',
              icon: 'success'
            })
          } catch (error) {
            console.error('更新状态失败:', error)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * 删除套餐
   */
  async deletePackage(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该套餐吗?删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            await packageApi.remove({ id })

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            // 重新加载列表
            this.resetAndLoad()
          } catch (error) {
            console.error('删除套餐失败:', error)
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
})