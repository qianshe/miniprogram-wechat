const { adminApi } = require('../../../../utils/api.js')
const { CURRENT_SYSTEM_TYPE } = require('../../../../config/constants.js')
const { checkAdminAccess } = require('../../common/adminGuard.js')

function normalizeType(type) {
  if (type === 'red' || Number(type) === 1) {
    return 'red'
  }
  return CURRENT_SYSTEM_TYPE
}

function parseMultilineList(value = '') {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function stringifyMultilineList(list = []) {
  return Array.isArray(list) ? list.filter(Boolean).join('\n') : ''
}

Page({
  data: {
    isEdit: false,
    id: '',
    isSubmitting: false,
    formData: {
      title: '',
      description: '',
      content: '',
      order: 1,
      imageUrl: '',
      tipsText: '',
      productListText: '',
      status: 1,
      type: CURRENT_SYSTEM_TYPE
    }
  },

  onLoad(options = {}) {
    if (!checkAdminAccess()) return

    const id = options.id || ''
    const isEdit = Boolean(id)

    this.setData({ isEdit, id })
    wx.setNavigationBarTitle({ title: isEdit ? '编辑流程' : '新增流程' })

    if (isEdit) {
      this.loadStepDetail(id)
    }
  },

  async loadStepDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' })
      const detail = await adminApi.getStepDetail(id)
      wx.hideLoading()

      this.setData({
        formData: {
          title: detail?.title || '',
          description: detail?.description || '',
          content: detail?.content || '',
          order: Number(detail?.order || 1),
          imageUrl: detail?.imageUrl || '',
          tipsText: stringifyMultilineList(detail?.tips),
          productListText: stringifyMultilineList(detail?.productList),
          status: detail?.status !== undefined ? Number(detail.status) : 1,
          type: normalizeType(detail?.type)
        }
      })
    } catch (error) {
      wx.hideLoading()
      console.error('[admin/process/edit] 加载流程详情失败:', error)
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onTitleChange(e) {
    this.setData({ 'formData.title': e.detail.value })
  },

  onDescriptionChange(e) {
    this.setData({ 'formData.description': e.detail.value })
  },

  onContentChange(e) {
    this.setData({ 'formData.content': e.detail.value })
  },

  onImageUrlChange(e) {
    this.setData({ 'formData.imageUrl': e.detail.value })
  },

  onTipsChange(e) {
    this.setData({ 'formData.tipsText': e.detail.value })
  },

  onProductListChange(e) {
    this.setData({ 'formData.productListText': e.detail.value })
  },

  onOrderChange(e) {
    this.setData({
      'formData.order': Number(e.detail.value || 1)
    })
  },

  onStatusChange(e) {
    this.setData({
      'formData.status': Number(e.detail.value)
    })
  },

  validateForm() {
    const { title, description } = this.data.formData

    if (!String(title || '').trim()) {
      wx.showToast({ title: '请输入步骤标题', icon: 'none' })
      return false
    }

    if (!String(description || '').trim()) {
      wx.showToast({ title: '请输入步骤摘要', icon: 'none' })
      return false
    }

    return true
  },

  buildPayload() {
    const { formData } = this.data

    return {
      title: String(formData.title || '').trim(),
      description: String(formData.description || '').trim(),
      content: String(formData.content || '').trim(),
      order: Number(formData.order || 1),
      imageUrl: String(formData.imageUrl || '').trim(),
      tips: parseMultilineList(formData.tipsText),
      productList: parseMultilineList(formData.productListText),
      status: Number(formData.status === 0 ? 0 : 1),
      type: formData.type || CURRENT_SYSTEM_TYPE
    }
  },

  async submitForm() {
    if (this.data.isSubmitting || !this.validateForm()) {
      return
    }

    this.setData({ isSubmitting: true })

    try {
      const payload = this.buildPayload()

      if (this.data.isEdit) {
        await adminApi.updateProcessStep(this.data.id, payload)
      } else {
        await adminApi.createProcessStep(payload)
      }

      wx.showToast({
        title: this.data.isEdit ? '保存成功' : '创建成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
    } catch (error) {
      console.error('[admin/process/edit] 保存流程失败:', error)
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
