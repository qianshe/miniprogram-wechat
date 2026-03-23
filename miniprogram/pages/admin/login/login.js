const { callCloudFunction } = require('../../../utils/api.js')
const auth = require('../../../utils/auth.js')

const app = getApp()

Page({
  data: {
    adminAccount: '',
    password: '',
    rememberAccount: false,
    loading: false,
    errorMessage: ''
  },

  onLoad(options) {
    const rememberedAccount = wx.getStorageSync('adminAccount') || ''
    if (rememberedAccount) {
      this.setData({
        adminAccount: rememberedAccount,
        rememberAccount: true,
        password: ''
      })
    }

    if (auth.hasValidAdminSession()) {
      wx.reLaunch({ url: '/pages/admin/index/index' })
      return
    }
  },

  onAccountInput(e) {
    this.setData({ adminAccount: (e.detail.value || '').trim() })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value || '' })
  },

  clearAccountInput() {
    this.setData({ adminAccount: '', errorMessage: '' })
  },

  clearPasswordInput() {
    this.setData({ password: '', errorMessage: '' })
  },

  onRememberChange(e) {
    this.setData({ rememberAccount: !!e.detail.value })
  },

  async onLogin() {
    const { adminAccount, password, rememberAccount } = this.data

    if (!this.validateForm()) return

    this.setData({ loading: true, errorMessage: '' })

    try {
      const result = await callCloudFunction('login', 'adminLogin', {
        account: adminAccount,
        password: password
      })

      // callCloudFunction 成功时返回 data 部分（code !== 200 会抛错）
      const userInfoWithRole = {
        openid: result.openid,
        nickName: result.userInfo?.nickName || '管理员',
        avatarUrl: result.userInfo?.avatarUrl || '',
        role: result.role || 1,
        isAdmin: true
      }

      // 统一走认证工具写入，确保安全戳/会话状态与守卫标准一致
      auth.setAuth(userInfoWithRole)
      wx.setStorageSync('adminInfo', result.userInfo)

      const normalizedAccount = (adminAccount || '').trim()
      if (rememberAccount && normalizedAccount) {
        wx.setStorageSync('adminAccount', normalizedAccount)
      } else {
        wx.removeStorageSync('adminAccount')
      }

      wx.showToast({ title: '登录成功', icon: 'success' })

      setTimeout(() => {
        wx.reLaunch({ url: '/pages/admin/index/index' })
      }, 800)
    } catch (error) {
      console.error('管理员登录失败:', error)
      const msg = error.message || '登录失败，请检查账号密码'
      this.setData({ errorMessage: msg })
    } finally {
      this.setData({ loading: false })
    }
  },

  validateForm() {
    const { adminAccount, password } = this.data

    if (!adminAccount) {
      this.setData({ errorMessage: '请输入管理员账号' })
      return false
    }
    if (!password) {
      this.setData({ errorMessage: '请输入密码' })
      return false
    }
    if (password.length < 6) {
      this.setData({ errorMessage: '密码长度不能少于6位' })
      return false
    }
    return true
  }
})
