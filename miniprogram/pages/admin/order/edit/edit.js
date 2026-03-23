const { checkAdminAccess } = require('../../common/adminGuard.js')
const validation = require('../../utils/validation.js')
const {
  EDITABLE_ORDER_V1_FIELDS,
  canSubmitEditableOrderForm,
  buildUpdateOrderContentPayload
} = require('./helpers/order-edit-form.helper.js')
const {
  getInitialFormData,
  getInitialPagination,
  normalizeEditableFormData,
  getDraftTotalAmount,
  buildV1EditValidationRules,
  hasRequiredEditableFields,
  getOrderEditLoadErrorState,
  loadEditableOrderDetail,
  loadCategoryOptions,
  loadProductPage,
  updateFilteredProductsSelection,
  upsertDraftItemFromProduct,
  changeDraftItemQuantity,
  removeDraftItemByIndex
} = require('./order-edit.logic.js')

const pageConfig = {
  data: {
    orderNo: '',
    isAdmin: false,
    editableFields: EDITABLE_ORDER_V1_FIELDS,
    formData: getInitialFormData(),
    initialFormData: getInitialFormData(),
    initialItems: [],
    itemsDraft: [],
    expectedUpdateTime: null,
    orderInfo: null,
    adminEditState: null,
    loading: false,
    saving: false,
    canSave: false,
    hasValidationErrors: false,
    errors: {},
    fieldErrors: {},
    error: '',
    showProductSelector: false,
    categories: [],
    currentCategoryIndex: 0,
    currentCategoryId: '',
    productList: [],
    filteredProducts: [],
    productsLoading: false,
    productsPagination: getInitialPagination(),
    draftTotalAmount: '0.00',
    duplicatePriceProductIds: [],
    itemMutationBlocked: false,
    itemMutationReason: '',
    itemSectionTip: '支持新增/调整/删除服务项，保存后仅更新本记录',
    itemMutationNotice: '',
    itemMutationBadgeText: '',
    draftSummaryLabel: '暂存记录金额'
  },

  updateDerivedState(nextPartialData = {}) {
    const mergedData = {
      ...this.data,
      ...nextPartialData
    }

    const fieldErrors = mergedData.fieldErrors || {}
    const errors = mergedData.errors || {}
    const hasValidationErrors = Object.keys(fieldErrors).length > 0 || Object.keys(errors).length > 0
    const hasItems = Array.isArray(mergedData.itemsDraft) && mergedData.itemsDraft.length > 0
    const hasRequiredFields = hasRequiredEditableFields(mergedData.formData)
    const editAllowed = !mergedData.adminEditState || mergedData.adminEditState.showEditOrderEntry
    const canSave = editAllowed && hasItems && canSubmitEditableOrderForm(
      mergedData.initialFormData,
      mergedData.formData,
      mergedData.initialItems,
      mergedData.itemsDraft
    ) && hasRequiredFields

    this.setData({
      canSave,
      hasValidationErrors,
      draftTotalAmount: getDraftTotalAmount(mergedData.itemsDraft).toFixed(2)
    })
  },

  onLoad(options = {}) {
    if (!checkAdminAccess()) {
      return
    }

    const { orderNo = '', isAdmin = '' } = options
    const canLoad = !!orderNo
    this.setData({
      orderNo,
      isAdmin: isAdmin === true || isAdmin === 'true' || isAdmin === '1',
      error: canLoad ? '' : '缺少订单号',
      loading: canLoad
    })

    this.loadCategories()

    if (canLoad) {
      this.loadOrderDetail()
    }
  },

  async loadOrderDetail() {
    if (!this.data.orderNo) {
      this.setData({
        loading: false,
        error: '缺少订单号'
      })
      return
    }

    this.setData({ loading: true, error: '' })

    try {
      const loadedState = await loadEditableOrderDetail(this.data.orderNo)

      this.setData({
        orderInfo: loadedState.orderInfo,
        formData: loadedState.formData,
        initialFormData: loadedState.initialFormData,
        initialItems: loadedState.initialItems,
        itemsDraft: loadedState.itemsDraft,
        expectedUpdateTime: loadedState.expectedUpdateTime,
        draftTotalAmount: loadedState.draftTotalAmount,
        duplicatePriceProductIds: loadedState.duplicatePriceProductIds,
        ...loadedState.itemMutationUiState,
        adminEditState: loadedState.adminEditState,
        loading: false,
        errors: {},
        fieldErrors: {},
        error: loadedState.blockedError
      })
      this.updateDerivedState({
        initialItems: loadedState.initialItems,
        itemsDraft: loadedState.itemsDraft,
        adminEditState: loadedState.adminEditState
      })
    } catch (error) {
      const message = (error && error.message) || '获取服务记录详情失败'
      this.setData(getOrderEditLoadErrorState(message))
      this.updateDerivedState({ initialItems: [], itemsDraft: [], adminEditState: null })

      wx.showToast({
        title: message,
        icon: 'none'
      })
    }
  },

  async loadCategories() {
    try {
      const app = typeof getApp === 'function' ? getApp() : { globalData: {} }
      const type = (app && app.globalData && app.globalData.systemType) || 'white'
      const categoriesWithAll = await loadCategoryOptions(type)
      this.setData({
        categories: categoriesWithAll,
        currentCategoryIndex: 0,
        currentCategoryId: ''
      }, () => {
        this.loadProducts(true)
      })
    } catch (err) {
      this.loadProducts(true)
    }
  },

  async loadProducts(isRefresh = false) {
    if (this.data.productsLoading) return
    if (!isRefresh && !this.data.productsPagination.hasMore) return

    const page = isRefresh ? 1 : this.data.productsPagination.page
    this.setData({ productsLoading: true })

    try {
      const newProducts = await loadProductPage({
        page,
        size: this.data.productsPagination.size,
        categoryId: this.data.currentCategoryId
      })
      const productList = isRefresh ? newProducts : [...this.data.productList, ...newProducts]
      const filteredProducts = this.updateFilteredProductsSelection(productList, this.data.itemsDraft)

      this.setData({
        productList,
        filteredProducts,
        productsLoading: false,
        'productsPagination.page': page + 1,
        'productsPagination.hasMore': newProducts.length >= this.data.productsPagination.size
      })
    } catch (err) {
      this.setData({ productsLoading: false })
    }
  },

  updateFilteredProductsSelection(products = [], itemsDraft = []) {
    return updateFilteredProductsSelection(products, itemsDraft)
  },

  ensureCanMutateItems() {
    if (this.data.itemMutationReason === 'workflow-locked') {
      wx.showToast({
        title: '当前阶段仅支持修改时间与备注',
        icon: 'none'
      })
      return false
    }

    if (!this.data.itemMutationBlocked) {
      return true
    }

    wx.showToast({
      title: '该记录商品清单当前只读',
      icon: 'none'
    })
    return false
  },

  openProductSelector() {
    if (!this.ensureCanMutateItems()) {
      return
    }

    this.setData({
      showProductSelector: true,
      filteredProducts: this.updateFilteredProductsSelection(this.data.productList, this.data.itemsDraft)
    })
  },

  closeProductSelector() {
    this.setData({ showProductSelector: false })
  },

  onCategoryChange(e) {
    const index = e.detail && typeof e.detail.index === 'number' ? e.detail.index : 0
    if (index === this.data.currentCategoryIndex) return

    const category = this.data.categories[index] || { id: '' }
    this.setData({
      currentCategoryIndex: index,
      currentCategoryId: category.id,
      productList: [],
      filteredProducts: [],
      productsPagination: getInitialPagination()
    }, () => {
      this.loadProducts(true)
    })
  },

  onLoadMoreProducts() {
    this.loadProducts(false)
  },

  onProductSelect(e = {}) {
    if (!this.ensureCanMutateItems()) {
      return
    }

    const product = e.detail && e.detail.product
    const productId = product && (product.id || product._id)
    if (!productId) {
      wx.showToast({ title: '商品数据异常', icon: 'none' })
      return
    }

    const nextItemsDraft = upsertDraftItemFromProduct(this.data.itemsDraft, product)
    this.setData({
      itemsDraft: nextItemsDraft,
      filteredProducts: this.updateFilteredProductsSelection(this.data.productList, nextItemsDraft)
    })
    this.updateDerivedState({ itemsDraft: nextItemsDraft })
  },

  increaseItemQuantity(e = {}) {
    if (!this.ensureCanMutateItems()) {
      return
    }

    const index = Number(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || !this.data.itemsDraft[index]) {
      return
    }

    const nextItemsDraft = changeDraftItemQuantity(this.data.itemsDraft, index, 1)
    this.setData({ itemsDraft: nextItemsDraft })
    this.updateDerivedState({ itemsDraft: nextItemsDraft })
  },

  decreaseItemQuantity(e = {}) {
    if (!this.ensureCanMutateItems()) {
      return
    }

    const index = Number(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index)
    const targetItem = this.data.itemsDraft[index]
    if (!Number.isInteger(index) || !targetItem) {
      return
    }

    if (targetItem.quantity > 1) {
      const nextItemsDraft = changeDraftItemQuantity(this.data.itemsDraft, index, -1)

      this.setData({ itemsDraft: nextItemsDraft })
      this.updateDerivedState({ itemsDraft: nextItemsDraft })
      return
    }

    this.removeItem(e)
  },

  removeItem(e = {}) {
    if (!this.ensureCanMutateItems()) {
      return
    }

    const index = Number(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || !this.data.itemsDraft[index]) {
      return
    }

    if (this.data.itemsDraft.length <= 1) {
      wx.showToast({ title: '服务记录至少保留一个服务项', icon: 'none' })
      return
    }

    const nextItemsDraft = removeDraftItemByIndex(this.data.itemsDraft, index)

    this.setData({ itemsDraft: nextItemsDraft })
    this.updateDerivedState({ itemsDraft: nextItemsDraft })
  },

  canSubmit() {
    const hasItems = Array.isArray(this.data.itemsDraft) && this.data.itemsDraft.length > 0
    return hasItems
      && hasRequiredEditableFields(this.data.formData)
      && canSubmitEditableOrderForm(
      this.data.initialFormData,
      this.data.formData,
      this.data.initialItems,
      this.data.itemsDraft
      )
  },

  buildUpdatePayload() {
    return buildUpdateOrderContentPayload({
      orderId: this.data.orderInfo && (this.data.orderInfo._id || this.data.orderInfo.id) || '',
      expectedUpdateTime: this.data.expectedUpdateTime,
      initialForm: this.data.initialFormData,
      currentForm: this.data.formData,
      initialItems: this.data.initialItems,
      currentItems: this.data.itemsDraft
    })
  },

  validateEditForm() {
    const normalizedFormData = normalizeEditableFormData(this.data.formData)
    const formValidation = validation.validateForm(normalizedFormData, buildV1EditValidationRules())
    const fieldErrors = formValidation.errors || {}
    const errors = { ...fieldErrors }

    this.setData({
      fieldErrors,
      errors
    })
    this.updateDerivedState({ fieldErrors, errors })

    return !!formValidation.valid
  },

  clearFieldValidationError(field) {
    if (!field) {
      return
    }

    const nextFieldErrors = { ...(this.data.fieldErrors || {}) }
    const nextErrors = { ...(this.data.errors || {}) }
    delete nextFieldErrors[field]
    delete nextErrors[field]

    this.setData({
      fieldErrors: nextFieldErrors,
      errors: nextErrors
    })
    this.updateDerivedState({
      fieldErrors: nextFieldErrors,
      errors: nextErrors
    })
  },

  onServiceTimeChange(e = {}) {
    const serviceTime = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({
      'formData.serviceTime': serviceTime
    })
    this.clearFieldValidationError('serviceTime')
  },

  onInputChange(e = {}) {
    const field = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field
    if (!field || !Object.prototype.hasOwnProperty.call(this.data.formData, field)) {
      return
    }

    const raw = e.detail && Object.prototype.hasOwnProperty.call(e.detail, 'value')
      ? e.detail.value
      : ''
    const value = typeof raw === 'string' ? raw : `${raw || ''}`

    this.setData({
      [`formData.${field}`]: value
    })
    this.clearFieldValidationError(field)
  },

  goBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }

    wx.switchTab({ url: '/pages/index/index' })
  },

  async submitEdit() {
    if (this.data.saving) {
      return
    }

    if (this.data.adminEditState && !this.data.adminEditState.showEditOrderEntry) {
      wx.showToast({ title: '当前服务记录状态不允许编辑', icon: 'none' })
      return
    }

    if (!this.canSubmit()) {
      const serviceTime = normalizeEditableFormData(this.data.formData).serviceTime
      if (!serviceTime) {
        const nextFieldErrors = {
          ...(this.data.fieldErrors || {}),
          serviceTime: '服务时间不能为空'
        }
        const nextErrors = {
          ...(this.data.errors || {}),
          serviceTime: '服务时间不能为空'
        }
        this.setData({
          fieldErrors: nextFieldErrors,
          errors: nextErrors
        })
        this.updateDerivedState({
          fieldErrors: nextFieldErrors,
          errors: nextErrors
        })
        wx.showToast({ title: '请完善表单信息', icon: 'none' })
        return
      }

      wx.showToast({ title: '暂无可保存修改', icon: 'none' })
      return
    }

    if (this.data.itemsDraft.length === 0) {
      wx.showToast({ title: '订单至少保留一个商品', icon: 'none' })
      return
    }

    if (!this.validateEditForm()) {
      wx.showToast({ title: '请完善表单信息', icon: 'none' })
      return
    }

    const payload = this.buildUpdatePayload()
    if (!payload.orderId) {
      wx.showToast({ title: '服务记录信息未就绪', icon: 'none' })
      return
    }

    const hasValidExpectedUpdateTime = typeof payload.expectedUpdateTime === 'string' && payload.expectedUpdateTime
    const hasValidChanges = payload.changes && typeof payload.changes === 'object' && Object.keys(payload.changes).length > 0
    if (!hasValidExpectedUpdateTime || !hasValidChanges) {
      wx.showToast({ title: '当前变更无效，请刷新后重试', icon: 'none' })
      return
    }

    this.setData({ saving: true, error: '' })

    try {
      if (typeof this.getAdminApi().updateOrderContent !== 'function') {
        throw new Error('保存接口未就绪')
      }

      await this.getAdminApi().updateOrderContent(payload)
      wx.showToast({ title: '保存成功', icon: 'success' })
      wx.navigateBack({ delta: 1 })
    } catch (error) {
      const rawMessage = (error && error.message) || ''
      const isConflict = Number(error && error.code) === 1203 || /已被更新|资源冲突|stale|conflict/i.test(rawMessage)

      if (isConflict) {
        wx.showToast({ title: '订单已发生变更，请刷新后重试', icon: 'none' })
        await this.loadOrderDetail()
        return
      }

      const message = rawMessage || '保存失败，请稍后重试'
      this.setData({ error: message })
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  getAdminApi() {
    const app = typeof getApp === 'function' ? getApp() : null
    return (app && app.globalData && app.globalData.adminApi) || require('../../../../services/api').adminApi
  }
}

if (typeof Page === 'function') {
  Page(pageConfig)
}

module.exports = pageConfig