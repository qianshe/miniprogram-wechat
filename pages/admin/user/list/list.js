const userApi = require('../../../../api/user')
const app = getApp()

Page({
  data: {
    users: [],
    loading: false,
    hasMore: true,
    total: 0,
    page: 1,
    size: 20,
    keyword: '',
    filterType: 'all', // all, admin, user
    currentOpenid: '', // 当前登录用户的 openid

    // 操作相关
    showActionSheet: false,
    actionItems: [],
    currentUser: null,

    // 对话框
    showDialog: false,
    dialogTitle: '',
    dialogContent: '',
    dialogAction: '',

    // 用户详情弹窗
    showDetailDialog: false,
    detailUser: {}
  },

  onLoad() {
    // 获取当前登录用户的 openid
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
    this.setData({ currentOpenid: userInfo.openid || '' })
    this.loadUsers()
  },

  onShow() {
    // 页面显示时刷新数据
  },

  onPullDownRefresh() {
    this.setData({ page: 1, users: [], hasMore: true })
    this.loadUsers().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  async loadUsers() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const params = {
        page: this.data.page,
        size: this.data.size
      }

      if (this.data.keyword) {
        params.keyword = this.data.keyword
      }

      if (this.data.filterType === 'admin') {
        params.isAdmin = true
      } else if (this.data.filterType === 'user') {
        params.isAdmin = false
      }

      // call 函数成功时直接返回 data 字段，不需要再判断 code
      const res = await userApi.adminGetUsers(params)

      // res 就是云函数返回的 data 部分（records, total, hasMore等）
      const newUsers = (res.records || []).map(user => ({
        ...user,
        loginTimeStr: this.formatTime(user.loginTime)
      }))

      this.setData({
        users: this.data.page === 1 ? newUsers : [...this.data.users, ...newUsers],
        total: res.total || 0,
        hasMore: res.hasMore || newUsers.length === this.data.size
      })
    } catch (err) {
      console.error('[UserList] loadUsers error:', err)
      // 显示具体的错误信息
      const errorMsg = err.message || '加载失败'
      wx.showToast({ title: errorMsg, icon: 'none' })

      // 如果是权限错误，跳转到首页
      if (err.code === 403 || errorMsg.includes('permission') || errorMsg.includes('admin')) {
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index_home/index_home' })
        }, 1500)
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadUsers()
  },

  onSearchChange(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.setData({ page: 1, users: [], hasMore: true })
    this.loadUsers()
  },

  onSearchClear() {
    this.setData({ keyword: '', page: 1, users: [], hasMore: true })
    this.loadUsers()
  },

  // t-tabs 组件变更事件（保留兼容）
  onFilterChange(e) {
    this.setData({
      filterType: e.detail.value,
      page: 1,
      users: [],
      hasMore: true
    })
    this.loadUsers()
  },

  // 自定义标签点击事件
  onTabClick(e) {
    const value = e.currentTarget.dataset.value
    if (value === this.data.filterType) return

    this.setData({
      filterType: value,
      page: 1,
      users: [],
      hasMore: true
    })
    this.loadUsers()
  },

  // 快捷操作按钮
  onQuickAction(e) {
    const { user, action } = e.currentTarget.dataset

    // 根据 action 执行对应操作
    switch (action) {
      case 'setAdmin':
        this.setData({
          currentUser: user,
          pendingAction: 'setAdmin',
          dialogTitle: '设置管理员',
          dialogContent: `确定将 "${user.nickName || '该用户'}" 设为管理员吗？`,
          showDialog: true
        })
        break
      case 'removeAdmin':
        this.setData({
          currentUser: user,
          pendingAction: 'removeAdmin',
          dialogTitle: '取消管理员',
          dialogContent: `确定取消 "${user.nickName || '该用户'}" 的管理员权限吗？`,
          showDialog: true
        })
        break
      case 'disable':
        this.setData({
          currentUser: user,
          pendingAction: 'disable',
          dialogTitle: '禁用用户',
          dialogContent: `确定禁用 "${user.nickName || '该用户'}" 吗？禁用后该用户将无法登录。`,
          showDialog: true
        })
        break
      case 'enable':
        this.setData({
          currentUser: user,
          pendingAction: 'enable',
          dialogTitle: '启用用户',
          dialogContent: `确定启用 "${user.nickName || '该用户'}" 吗？`,
          showDialog: true
        })
        break
      default:
        console.warn('Unknown action:', action)
    }
  },

  onUserTap(e) {
    const { user } = e.currentTarget.dataset
    // 点击卡片显示用户详情
    this.showUserDetail(user)
  },

  // 显示用户详情弹窗
  showUserDetail(user) {
    this.setData({
      showDetailDialog: true,
      detailUser: user
    })
  },

  // 关闭详情弹窗
  onCloseDetailDialog() {
    this.setData({
      showDetailDialog: false,
      detailUser: {}
    })
  },

  // 阻止事件冒泡
  preventBubble() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 复制用户ID
  onCopyUserId() {
    const { detailUser } = this.data
    if (detailUser.openid) {
      wx.setClipboardData({
        data: detailUser.openid,
        success: () => {
          wx.showToast({ title: '已复制', icon: 'success' })
          this.setData({ showDetailDialog: false })
        }
      })
    }
  },

  // 按钮点击触发
  onActionTap(e) {
    const { user } = e.currentTarget.dataset
    this.showActionSheet(user)
  },

  // 辅助方法：显示操作菜单
  showActionSheet(user) {
    const items = []

    if (user.isAdmin) {
      items.push({ label: '取消管理员', action: 'removeAdmin' })
    } else {
      items.push({ label: '设为管理员', action: 'setAdmin' })
    }

    if (user.status === 0) {
      items.push({ label: '启用用户', action: 'enable' })
    } else {
      items.push({ label: '禁用用户', action: 'disable' })
    }

    this.setData({
      currentUser: user,
      actionItems: items,
      showActionSheet: true
    })
  },

  onActionSelect(e) {
    const { selected } = e.detail
    const action = this.data.actionItems[selected.index]?.action
    const user = this.data.currentUser

    this.setData({ showActionSheet: false })

    if (!action || !user) return

    switch (action) {
      case 'setAdmin':
        this.showConfirmDialog('设为管理员', `确定将 "${user.nickName}" 设为管理员吗？`, 'setAdmin')
        break
      case 'removeAdmin':
        this.showConfirmDialog('取消管理员', `确定取消 "${user.nickName}" 的管理员权限吗？`, 'removeAdmin')
        break
      case 'enable':
        this.showConfirmDialog('启用用户', `确定启用用户 "${user.nickName}" 吗？`, 'enable')
        break
      case 'disable':
        this.showConfirmDialog('禁用用户', `确定禁用用户 "${user.nickName}" 吗？禁用后该用户将无法使用系统。`, 'disable')
        break
    }
  },

  onActionCancel() {
    this.setData({ showActionSheet: false, currentUser: null })
  },

  showConfirmDialog(title, content, action) {
    this.setData({
      showDialog: true,
      dialogTitle: title,
      dialogContent: content,
      dialogAction: action
    })
  },

  async onDialogConfirm() {
    const { dialogAction, currentUser } = this.data
    this.setData({ showDialog: false })

    if (!currentUser) return

    try {
      let res
      switch (dialogAction) {
        case 'setAdmin':
          res = await userApi.adminSetAdminRole(currentUser._id, true)
          break
        case 'removeAdmin':
          res = await userApi.adminSetAdminRole(currentUser._id, false)
          break
        case 'enable':
          res = await userApi.adminUpdateUserStatus(currentUser._id, 1)
          break
        case 'disable':
          res = await userApi.adminUpdateUserStatus(currentUser._id, 0)
          break
      }

      if (res && (res.code === 200 || res.code === 0)) {
        wx.showToast({ title: '操作成功', icon: 'success' })
        // 刷新列表
        this.setData({ page: 1, users: [], hasMore: true })
        this.loadUsers()
      } else {
        wx.showToast({ title: res?.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[UserList] action error:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this.setData({ currentUser: null, dialogAction: '' })
    }
  },

  onDialogCancel() {
    this.setData({ showDialog: false, currentUser: null, dialogAction: '' })
  },

  formatTime(time) {
    if (!time) return '未知'
    const date = new Date(time)
    if (isNaN(date.getTime())) return '未知'
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
})
