// pages/admin/login/login.js
const { callCloudFunction } = require('../../../utils/api.js')
const validation = require('../../../utils/validation.js')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    adminAccount: '',
    password: '',
    loading: false,
    errorMessage: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已经登录管理员账号
    const isAdmin = wx.getStorageSync('isAdmin') || false
    if (isAdmin) {
      wx.reLaunch({
        url: '/pages/admin/index/index'
      })
    }
  },

  /**
   * 账号输入处理
   */
  onAccountInput(e) {
    this.setData({
      adminAccount: e.detail.value.trim()
    })
  },

  /**
   * 密码输入处理
   */
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },

  /**
   * 管理员登录
   */
  async onLogin() {
    const { adminAccount, password } = this.data

    // 表单验证
    if (!this.validateForm()) {
      return
    }

    this.setData({ loading: true, errorMessage: '' })

    try {
      // 调用云函数进行管理员验证
      const result = await callCloudFunction('login', 'adminLogin', {
        account: adminAccount,
        password: password
      })

      if (result.success) {
        // 保存管理员登录状态
        wx.setStorageSync('isAdmin', true)
        wx.setStorageSync('adminInfo', result.userInfo)

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 跳转到管理员首页
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/admin/index/index'
          })
        }, 1500)
      } else {
        this.setData({
          errorMessage: result.message || '账号或密码错误'
        })
      }
    } catch (error) {
      console.error('管理员登录失败:', error)
      this.setData({
        errorMessage: '登录失败，请检查网络连接'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 表单验证
   */
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

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})