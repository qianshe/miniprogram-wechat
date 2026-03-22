const { checkAdminAccess } = require('../../common/adminGuard.js')
const { adminApi, api } = require('../../../../utils/api.js')
const validation = require('../../utils/validation.js')
const { mapLegacyStatusToNew } = require('../../../../config/constants.js')
const { getAdminEditOrderState } = require('../../../order/detail/order-edit-state.helper.js')
const {
  EDITABLE_ORDER_V1_FIELDS,
  normalizeCoordinate,
  normalizeTimestampForCompare,
  canSubmitEditableOrderForm,
  buildUpdateOrderContentPayload
} = require('./helpers/order-edit-form.helper.js')

function getInitialFormData() {
  return {
    remark: '',
    serviceTime: ''
  }
}

function getInitialPagination() {
  return {
    page: 1,
    size: 20,
    hasMore: true
  }
}

function buildItemMutationUiState({ duplicatePriceProductIds = [], adminEditState = null } = {}) {
  const blockedBySplitItems = Array.isArray(duplicatePriceProductIds) && duplicatePriceProductIds.length > 0
  const blockedByWorkflow = !blockedBySplitItems && (!adminEditState || !adminEditState.showAppendItemsEntry)
  const itemMutationBlocked = blockedBySplitItems || blockedByWorkflow

  if (blockedBySplitItems) {
    return {
      itemMutationBlocked: true,
      itemMutationReason: 'split-items',
      itemSectionTip: '当前记录商品清单为历史快照，暂不支持直接改商品内容',
      itemMutationNotice: '当前记录存在历史拆分商品行，商品内容仅支持查看；如需调整，请通过新增服务记录处理。',
      itemMutationBadgeText: '商品只读',
      draftSummaryLabel: '当前记录金额'
    }
  }

  if (blockedByWorkflow) {
    return {
      itemMutationBlocked: true,
      itemMutationReason: 'workflow-locked',
      itemSectionTip: '当前阶段仅支持修改服务时间与备注，商品清单按记录快照只读展示',
      itemMutationNotice: '服务开始前不支持增删改商品内容；如需修改商品，请先进入可追加商品的处理阶段。',
      itemMutationBadgeText: '清单只读',
      draftSummaryLabel: '当前记录金额'
    }
  }

  return {
    itemMutationBlocked: false,
    itemMutationReason: '',
    itemSectionTip: '支持新增/调整/删除服务项，保存后仅更新本记录',
    itemMutationNotice: '',
    itemMutationBadgeText: '',
    draftSummaryLabel: '暂存记录金额'
  }
}

function normalizeServiceDateForPicker(value) {
  if (value === '' || value === null || value === undefined) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeEditableFormData(input = {}) {
  return {
    remark: typeof input.remark === 'string' ? input.remark.trim() : '',
    serviceTime: normalizeServiceDateForPicker(input.serviceTime)
  }
}

function normalizeMoney(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildDraftItem(raw = {}) {
  const productId = String(raw.productId || raw.id || raw._id || '').trim()
  if (!productId) {
    return null
  }

  const quantity = Math.max(0, parseInt(raw.quantity, 10) || 0)
  if (quantity <= 0) {
    return null
  }

  const price = normalizeMoney(raw.price !== undefined ? raw.price : raw.productPrice)
  const subtotal = price * quantity

  return {
    id: productId,
    productId,
    name: raw.productName || raw.name || '',
    price,
    quantity,
    subtotal,
    imageUrl: raw.productImage || raw.coverImage || raw.imageUrl || raw.image || raw.thumb || ''
  }
}

function decorateDraftItem(item) {
  const subtotal = normalizeMoney(item.price) * item.quantity
  return {
    ...item,
    subtotal,
    displayPrice: normalizeMoney(item.price).toFixed(2),
    displaySubtotal: subtotal.toFixed(2)
  }
}

function normalizeOrderItemsForDraft(items = []) {
  const mergedItems = []
  const indexMap = new Map()
  const duplicatePriceProductIds = new Set()

  ;(Array.isArray(items) ? items : []).forEach((rawItem) => {
    const item = buildDraftItem(rawItem)
    if (!item) {
      return
    }

    const existingIndex = indexMap.get(item.productId)
    if (existingIndex === undefined) {
      indexMap.set(item.productId, mergedItems.length)
      mergedItems.push(item)
      return
    }

    const existingItem = mergedItems[existingIndex]
    if (normalizeMoney(existingItem.price) !== normalizeMoney(item.price)) {
      duplicatePriceProductIds.add(item.productId)
      return
    }

    mergedItems[existingIndex] = {
      ...existingItem,
      quantity: existingItem.quantity + item.quantity
    }
  })

  return {
    itemsDraft: mergedItems.map(decorateDraftItem),
    duplicatePriceProductIds: Array.from(duplicatePriceProductIds)
  }
}

function getDraftTotalAmount(itemsDraft = []) {
  return (Array.isArray(itemsDraft) ? itemsDraft : []).reduce((sum, item) => {
    return sum + normalizeMoney(item.price) * (parseInt(item.quantity, 10) || 0)
  }, 0)
}

function normalizeOrderDetailForEdit(order = {}) {
  const normalizedFormData = normalizeEditableFormData({
    remark: order.remark,
    serviceTime: order.serviceTime
  })

  const expectedUpdateTime = normalizeTimestampForCompare(
    order.updateTime || order.updatedAt || order._updateTime || order.lastUpdateTime
  ) || null

  const normalizedItems = normalizeOrderItemsForDraft(order.items)

  return {
    orderInfo: {
      ...order
    },
    formData: normalizedFormData,
    expectedUpdateTime,
    initialItems: normalizedItems.itemsDraft.map((item) => ({ ...item })),
    itemsDraft: normalizedItems.itemsDraft.map((item) => ({ ...item })),
    duplicatePriceProductIds: normalizedItems.duplicatePriceProductIds
  }
}

function buildV1EditValidationRules() {
  return {
    serviceTime: {
      required: true,
      label: '服务时间'
    },
    remark: {
      label: '备注',
      validator(value) {
        const normalizedValue = typeof value === 'string' ? value.trim() : ''
        if (!normalizedValue) {
          return { valid: true }
        }

        const lengthResult = validation.validateStringLength(normalizedValue, 1, 500, '备注')
        if (!lengthResult.valid) {
          return lengthResult
        }

        const sensitiveResult = validation.checkSensitiveWords(normalizedValue)
        if (!sensitiveResult.valid) {
          return {
            valid: false,
            message: `备注包含敏感词：${sensitiveResult.matchedWords.join('、')}`
          }
        }

        return { valid: true }
      }
    }
  }
}

function hasRequiredEditableFields(formData = {}) {
  const normalizedFormData = normalizeEditableFormData(formData)
  return !!normalizedFormData.serviceTime
}

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
      const orderData = await adminApi.getOrderDetail(this.data.orderNo, true)
      const normalized = normalizeOrderDetailForEdit(orderData || {})
      const resolvedStatuses = normalized.orderInfo.orderStatus !== undefined && normalized.orderInfo.orderStatus !== null
        ? {
            orderStatus: normalized.orderInfo.orderStatus,
            paymentStatus: normalized.orderInfo.paymentStatus
          }
        : mapLegacyStatusToNew(normalized.orderInfo.status, normalized.orderInfo.payTime)
      const adminEditState = getAdminEditOrderState({
        isAdmin: true,
        orderStatus: resolvedStatuses.orderStatus,
        paymentStatus: resolvedStatuses.paymentStatus,
        waitForBind: normalized.orderInfo.waitForBind,
        contentConfirmedAt: normalized.orderInfo.contentConfirmedAt,
        workflowMilestone: normalized.orderInfo.workflowMilestone,
        isSharedView: false
      })
      const itemMutationUiState = buildItemMutationUiState({
        duplicatePriceProductIds: normalized.duplicatePriceProductIds,
        adminEditState
      })
      const blockedError = adminEditState.showEditOrderEntry ? '' : '当前服务记录状态不允许编辑'

      this.setData({
        orderInfo: normalized.orderInfo,
        formData: normalized.formData,
        initialFormData: { ...normalized.formData },
        initialItems: normalized.initialItems,
        itemsDraft: normalized.itemsDraft,
        expectedUpdateTime: normalized.expectedUpdateTime,
        draftTotalAmount: getDraftTotalAmount(normalized.itemsDraft).toFixed(2),
        duplicatePriceProductIds: normalized.duplicatePriceProductIds,
        ...itemMutationUiState,
        adminEditState,
        loading: false,
        errors: {},
        fieldErrors: {},
        error: blockedError
      })
      this.updateDerivedState({
        initialItems: normalized.initialItems,
        itemsDraft: normalized.itemsDraft,
        adminEditState
      })
    } catch (error) {
      const message = (error && error.message) || '获取服务记录详情失败'
      this.setData({
        orderInfo: null,
        formData: getInitialFormData(),
        initialFormData: getInitialFormData(),
        initialItems: [],
        itemsDraft: [],
        expectedUpdateTime: null,
        duplicatePriceProductIds: [],
        itemMutationBlocked: false,
        itemMutationReason: '',
        itemSectionTip: '支持新增/调整/删除服务项，保存后仅更新本记录',
        itemMutationNotice: '',
        itemMutationBadgeText: '',
        draftSummaryLabel: '暂存记录金额',
        adminEditState: null,
        draftTotalAmount: '0.00',
        loading: false,
        errors: {},
        fieldErrors: {},
        error: message
      })
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
      const categories = await api.getCategories({ type })
      const sortedCategories = categories
        .sort((a, b) => a.sort - b.sort)
        .map((category) => ({
          name: category.name,
          id: category._id || category.id || ''
        }))
      const categoriesWithAll = [{ id: '', name: '全部' }, ...sortedCategories]
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
      const params = {
        page,
        size: this.data.productsPagination.size,
        status: 1
      }

      if (this.data.currentCategoryId) {
        params.category = this.data.currentCategoryId
      }

      const result = await api.getProducts(params)
      const rawProducts = result.records || result.list || []
      const newProducts = rawProducts.map((product) => ({
        ...product,
        id: product._id || product.id,
        price: normalizeMoney(product.price),
        imageUrl: product.coverImage || product.thumb || product.imageUrl || product.image || ''
      }))
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
    return products.map((product) => {
      const selected = itemsDraft.find((item) => String(item.productId) === String(product.id))
      return {
        ...product,
        _isSelected: !!selected,
        _selectedQuantity: selected ? selected.quantity : 0
      }
    })
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

    const nextItemsDraft = this.data.itemsDraft.map((item) => ({ ...item }))
    const existingIndex = nextItemsDraft.findIndex((item) => String(item.productId) === String(productId))
    if (existingIndex > -1) {
      nextItemsDraft[existingIndex] = decorateDraftItem({
        ...nextItemsDraft[existingIndex],
        quantity: nextItemsDraft[existingIndex].quantity + 1
      })
    } else {
      nextItemsDraft.push(decorateDraftItem({
        id: productId,
        productId,
        name: product.name || '',
        price: normalizeMoney(product.price),
        quantity: 1,
        imageUrl: product.imageUrl || product.coverImage || product.thumb || product.image || ''
      }))
    }

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

    const nextItemsDraft = this.data.itemsDraft.map((item, currentIndex) => {
      if (currentIndex !== index) {
        return { ...item }
      }
      return decorateDraftItem({
        ...item,
        quantity: item.quantity + 1
      })
    })

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
      const nextItemsDraft = this.data.itemsDraft.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return { ...item }
        }
        return decorateDraftItem({
          ...item,
          quantity: item.quantity - 1
        })
      })

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

    const nextItemsDraft = this.data.itemsDraft
      .filter((_, currentIndex) => currentIndex !== index)
      .map((item) => ({ ...item }))

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
      if (typeof adminApi.updateOrderContent !== 'function') {
        throw new Error('保存接口未就绪')
      }

      await adminApi.updateOrderContent(payload)
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
  }
}

if (typeof Page === 'function') {
  Page(pageConfig)
}

module.exports = pageConfig
