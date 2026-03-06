const { callCloudFunction } = require('../../../utils/api.js')

const app = getApp()

Page({
  data: {
    adminAccount: '',
    password: '',
    loading: false,
    errorMessage: ''
  },

  onLoad(options) {
    const isAdmin = wx.getStorageSync('isAdmin') || false
    if (isAdmin) {
      wx.reLaunch({ url: '/pages/admin/index/index' })
    }
  },

  onAccountInput(e) {
    this.setData({ adminAccount: (e.detail.value || '').trim() })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value || '' })
  },

  async onLogin() {
    const { adminAccount, password } = this.data

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

      // 同步写入 userInfo，与用户端登录保持一致
      wx.setStorageSync('userInfo', userInfoWithRole)
      wx.setStorageSync('isAdmin', true)
      wx.setStorageSync('adminInfo', result.userInfo)

      app.globalData.userInfo = userInfoWithRole
      app.globalData.isAdmin = true

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