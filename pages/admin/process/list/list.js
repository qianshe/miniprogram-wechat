const { adminApi } = require('../../../../utils/api.js')
const { checkAdminAccess } = require('../../common/adminGuard.js')

Page({
  data: {
    rawSteps: [],
    displaySteps: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    isLoading: false,
    keyword: '',
    currentType: 'white'
  },

  onLoad() {
    if (!checkAdminAccess()) return
    this.loadSteps(true)
  },

  onShow() {
    if (this.data.rawSteps.length > 0) {
      this.loadSteps(true)
    }
  },

  onPullDownRefresh() {
    this.loadSteps(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadSteps(false)
    }
  },

  async loadSteps(reset = false) {
    if (reset) {
      this.setData({
        page: 1,
        rawSteps: [],
        displaySteps: [],
        hasMore: true,
        total: 0
      })
    }

    if (!this.data.hasMore || this.data.isLoading) {
      return
    }

    this.setData({ isLoading: true })

    try {
      const result = await adminApi.getProcessSteps({
        page: this.data.page,
        size: this.data.pageSize,
        type: this.data.currentType === 'red' ? 1 : 0
      })

      const records = Array.isArray(result)
        ? result
        : Array.isArray(result?.records)
          ? result.records
          : []
      const total = Array.isArray(result)
        ? records.length
        : Number(result?.total || records.length)

      const normalized = records.map((step) => this.normalizeStep(step))
      const rawSteps = reset ? normalized : [...this.data.rawSteps, ...normalized]
      const hasMore = rawSteps.length < total

      this.setData({
        rawSteps,
        page: this.data.page + 1,
        total,
        hasMore,
        isLoading: false
      })

      this.applySearchFilter()
    } catch (error) {
      console.error('[admin/process/list] 加载流程列表失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  normalizeStep(step = {}) {
    const type = step.type === 'red' ? 1 : Number(step.type || 0)
    const status = step.status !== undefined ? Number(step.status) : 1

    return {
      ...step,
      id: step._id || step.id || '',
      title: step.title || '未命名步骤',
      description: step.description || '暂无摘要说明',
      content: step.content || '',
      type,
      typeText: type === 1 ? '兼容红事' : '白事流程',
      order: Number(step.order || 0),
      status,
      statusText: status === 1 ? '启用' : '停用',
      tips: Array.isArray(step.tips) ? step.tips : [],
      productList: Array.isArray(step.productList) ? step.productList : []
    }
  },

  applySearchFilter() {
    const keyword = (this.data.keyword || '').trim().toLowerCase()
    if (!keyword) {
      this.setData({ displaySteps: this.data.rawSteps })
      return
    }

    const displaySteps = this.data.rawSteps.filter((item) => {
      const haystacks = [
        item.title,
        item.description,
        item.content,
        String(item.order)
      ]

      return haystacks.some((text) => String(text || '').toLowerCase().includes(keyword))
    })

    this.setData({ displaySteps })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.applySearchFilter()
    })
  },

  onSearchClear() {
    this.setData({ keyword: '' }, () => {
      this.applySearchFilter()
    })
  },

  onSearchConfirm() {
    this.applySearchFilter()
  },

  onTypeChange(e) {
    const { type } = e.currentTarget.dataset
    if (!type || type === this.data.currentType) return

    this.setData({ currentType: type }, () => {
      this.loadSteps(true)
    })
  }
})
