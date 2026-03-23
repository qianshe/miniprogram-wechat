const { api, adminApi } = require('../../../../services/api/index.js')
const validation = require('../../utils/validation.js')
const { mapLegacyStatusToNew } = require('../../../../config/constants.js')
const { getAdminEditOrderState } = require('../../../order/detail/order-edit-state.helper.js')
const {
  EDITABLE_ORDER_V1_FIELDS,
  normalizeTimestampForCompare
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

async function loadEditableOrderDetail(orderNo, deps = {}) {
  const adminApiImpl = deps.adminApi || adminApi
  const orderData = await adminApiImpl.getOrderDetail(orderNo, true)
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

  return {
    orderInfo: normalized.orderInfo,
    formData: normalized.formData,
    initialFormData: { ...normalized.formData },
    initialItems: normalized.initialItems,
    itemsDraft: normalized.itemsDraft,
    expectedUpdateTime: normalized.expectedUpdateTime,
    draftTotalAmount: getDraftTotalAmount(normalized.itemsDraft).toFixed(2),
    duplicatePriceProductIds: normalized.duplicatePriceProductIds,
    adminEditState,
    blockedError: adminEditState.showEditOrderEntry ? '' : '当前服务记录状态不允许编辑',
    itemMutationUiState
  }
}

function getOrderEditLoadErrorState(message = '获取服务记录详情失败') {
  return {
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
  }
}

async function loadCategoryOptions(systemType = 'white', deps = {}) {
  const apiImpl = deps.api || api
  const categories = await apiImpl.getCategories({ type: systemType })

  const sortedCategories = (Array.isArray(categories) ? [...categories] : [])
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map((category) => ({
      name: category.name,
      id: category._id || category.id || ''
    }))

  return [{ id: '', name: '全部' }, ...sortedCategories]
}

async function loadProductPage({ page = 1, size = 20, categoryId = '' } = {}, deps = {}) {
  const apiImpl = deps.api || api
  const params = {
    page,
    size,
    status: 1
  }

  if (categoryId) {
    params.category = categoryId
  }

  const result = await apiImpl.getProducts(params)
  const rawProducts = result.records || result.list || []
  return rawProducts.map((product) => ({
    ...product,
    id: product._id || product.id,
    price: normalizeMoney(product.price),
    imageUrl: product.coverImage || product.thumb || product.imageUrl || product.image || ''
  }))
}

function updateFilteredProductsSelection(products = [], itemsDraft = []) {
  return (Array.isArray(products) ? products : []).map((product) => {
    const selected = (Array.isArray(itemsDraft) ? itemsDraft : []).find((item) => String(item.productId) === String(product.id))
    return {
      ...product,
      _isSelected: !!selected,
      _selectedQuantity: selected ? selected.quantity : 0
    }
  })
}

function upsertDraftItemFromProduct(itemsDraft = [], product = {}) {
  const productId = product && (product.id || product._id)
  if (!productId) {
    return Array.isArray(itemsDraft) ? itemsDraft.map((item) => ({ ...item })) : []
  }

  const nextItemsDraft = Array.isArray(itemsDraft) ? itemsDraft.map((item) => ({ ...item })) : []
  const existingIndex = nextItemsDraft.findIndex((item) => String(item.productId) === String(productId))

  if (existingIndex > -1) {
    nextItemsDraft[existingIndex] = decorateDraftItem({
      ...nextItemsDraft[existingIndex],
      quantity: nextItemsDraft[existingIndex].quantity + 1
    })
    return nextItemsDraft
  }

  nextItemsDraft.push(decorateDraftItem({
    id: productId,
    productId,
    name: product.name || '',
    price: normalizeMoney(product.price),
    quantity: 1,
    imageUrl: product.imageUrl || product.coverImage || product.thumb || product.image || ''
  }))

  return nextItemsDraft
}

function changeDraftItemQuantity(itemsDraft = [], index, delta) {
  if (!Number.isInteger(index) || !Array.isArray(itemsDraft) || !itemsDraft[index]) {
    return Array.isArray(itemsDraft) ? itemsDraft.map((item) => ({ ...item })) : []
  }

  return itemsDraft.map((item, currentIndex) => {
    if (currentIndex !== index) {
      return { ...item }
    }

    return decorateDraftItem({
      ...item,
      quantity: item.quantity + delta
    })
  })
}

function removeDraftItemByIndex(itemsDraft = [], index) {
  if (!Number.isInteger(index) || !Array.isArray(itemsDraft) || !itemsDraft[index]) {
    return Array.isArray(itemsDraft) ? itemsDraft.map((item) => ({ ...item })) : []
  }

  return itemsDraft
    .filter((_, currentIndex) => currentIndex !== index)
    .map((item) => ({ ...item }))
}

module.exports = {
  EDITABLE_ORDER_V1_FIELDS,
  getInitialFormData,
  getInitialPagination,
  buildItemMutationUiState,
  normalizeEditableFormData,
  normalizeMoney,
  decorateDraftItem,
  getDraftTotalAmount,
  normalizeOrderDetailForEdit,
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
}