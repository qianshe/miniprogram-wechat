const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildItemMutationUiState,
  loadCategoryOptions,
  loadProductPage,
  normalizeOrderDetailForEdit,
  upsertDraftItemFromProduct
} = require('../../miniprogram/pages/admin/order/edit/order-edit.logic.js')

test('loadCategoryOptions sorts categories and prepends all option', async () => {
  const result = await loadCategoryOptions('white', {
    api: {
      getCategories: async () => ([
        { id: 'b', name: '乙类', sort: 2 },
        { id: 'a', name: '甲类', sort: 1 }
      ])
    }
  })

  assert.deepEqual(result, [
    { id: '', name: '全部' },
    { id: 'a', name: '甲类' },
    { id: 'b', name: '乙类' }
  ])
})

test('loadProductPage normalizes product shape', async () => {
  const result = await loadProductPage({ page: 1, size: 20, categoryId: 'cat-1' }, {
    api: {
      getProducts: async () => ({
        records: [{ _id: 'p1', name: '服务项', price: '12.50', coverImage: 'cover.png' }]
      })
    }
  })

  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    _id: 'p1',
    name: '服务项',
    price: 12.5,
    coverImage: 'cover.png',
    id: 'p1',
    imageUrl: 'cover.png'
  })
})

test('normalizeOrderDetailForEdit builds comparable draft state', () => {
  const result = normalizeOrderDetailForEdit({
    remark: '  已登记  ',
    serviceTime: '2026-03-21T10:00:00.000Z',
    items: [
      { productId: 'p1', productName: '鲜花', quantity: 1, productPrice: 12.5 },
      { productId: 'p1', productName: '鲜花', quantity: 2, productPrice: 12.5 }
    ]
  })

  assert.equal(result.formData.remark, '已登记')
  assert.equal(result.formData.serviceTime, '2026-03-21')
  assert.equal(result.itemsDraft.length, 1)
  assert.equal(result.itemsDraft[0].quantity, 3)
  assert.equal(result.itemsDraft[0].displaySubtotal, '37.50')
})

test('buildItemMutationUiState reflects workflow and split-item constraints', () => {
  const splitState = buildItemMutationUiState({ duplicatePriceProductIds: ['p1'] })
  assert.equal(splitState.itemMutationBlocked, true)
  assert.equal(splitState.itemMutationReason, 'split-items')

  const workflowState = buildItemMutationUiState({ duplicatePriceProductIds: [], adminEditState: { showAppendItemsEntry: false } })
  assert.equal(workflowState.itemMutationBlocked, true)
  assert.equal(workflowState.itemMutationReason, 'workflow-locked')
})

test('upsertDraftItemFromProduct increments quantity for existing product', () => {
  const result = upsertDraftItemFromProduct([
    { productId: 'p1', price: 10, quantity: 1, name: '鲜花', imageUrl: '' }
  ], {
    id: 'p1',
    price: 10,
    name: '鲜花',
    imageUrl: ''
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].quantity, 2)
  assert.equal(result[0].displaySubtotal, '20.00')
})
