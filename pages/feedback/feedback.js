// pages/feedback/feedback.js
const { api } = require('../../utils/api.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    content: '',
    contact: '',
    fileList: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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

  },

  onContentChange(e) {
    this.setData({ content: e.detail.value })
  },

  onContactChange(e) {
    this.setData({ contact: e.detail.value })
  },

  handleSuccess(e) {
    const { files } = e.detail
    this.setData({
      fileList: [...this.data.fileList, ...files]
    })
  },

  handleRemove(e) {
    const { index } = e.detail
    const fileList = this.data.fileList
    fileList.splice(index, 1)
    this.setData({ fileList })
  },

  submitFeedback() {
    if (!this.data.content) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }
    
    api.submitFeedback({
      content: this.data.content,
      contact: this.data.contact,
      images: this.data.fileList
    })
      .then(() => {
        wx.showToast({ title: '提交成功' })
        setTimeout(() => wx.navigateBack(), 1500)
      })
      .catch(err => {
        console.error('提交反馈失败:', err);
        wx.showToast({
          title: err.message || '提交失败，请重试',
          icon: 'none'
        })
      })
  }
})