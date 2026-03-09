const packageApi = require('../../../../api/package.js')
const productApi = require('../../../../api/product.js')
const { adminApi } = require('../../../../utils/api')
const { checkAdminAccess } = require('../../common/adminGuard.js')

Page({
  data: {
    isEdit: false,
    id: null,
    formData: {
      name: '',
      description: '',
      type: 'white', // 固定为白事类型
      imageUrl: '',
      status: 1,
      sort: 0,
      template: []
    },
    fileList: [],
    // 分类数据
    categories: [],
    // 商品数据（按分类分组）
    productsByCategory: {},
    // 分类选择弹窗
    showCategoryModal: false,
    selectedCategoryId: '',
    currentSlotIndex: -1,
    // 商品选择弹窗
    showProductModal: false,
    selectedProductId: '',
    categoryProducts: [],
    // 保存状态
    saving: false,
    // 套餐总价（动态计算）
    calculatedTotalPrice: 0,
    // 分类选择弹窗数据（带禁用状态）
    pickerCategories: [],
    // 是否可以添加分类
    canAddSlot: true
  },

  // 价格单位归一化：后端商品价格存储为"元"，统一转换为"分"（整数）
  normalizeFen(raw) {
    if (raw === null || raw === undefined || raw === '') return 0
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
    if (isNaN(num)) return 0
    // 后端商品价格是"元"，统一乘以100转为"分"
    return Math.round(num * 100)
  },

  // 将旧格式模板数据转换为新格式（兼容性处理）
  // 注意：云函数 getPackageDetail 返回的 product.price 已经是"元"，需要转回"分"
  normalizeTemplate(template) {
    if (!template || !Array.isArray(template)) {
      return []
    }
    return template.map(item => {
      // 如果已经是新格式（有products数组），直接返回
      if (item.products && Array.isArray(item.products)) {
        return {
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          products: item.products.map(p => ({
            productId: p.productId || '',
            productName: p.productName || '',
            price: Math.round((p.price || 0) * 100),  // 元转分，与页面其他地方保持一致
            quantity: p.quantity || 1,
            imageUrl: p.imageUrl || ''
          }))
        }
      }
      // 旧格式转换为新格式
      const newItem = {
        categoryId: item.categoryId || '',
        categoryName: item.categoryName || '',
        products: []
      }
      // 如果旧格式有默认商品，转换为products数组
      if (item.defaultProductId) {
        newItem.products.push({
          productId: item.defaultProductId,
          productName: item.defaultProductName || '',
          price: 0, // 旧格式没有价格，需要后续加载
          quantity: item.quantity || 1,
          imageUrl: ''
        })
      }
      return newItem
    })
  },

  // 计算套餐总价
  calculateTotalPrice() {
    const template = this.data.formData.template || []
    let total = 0
    template.forEach(slot => {
      if (slot.products && Array.isArray(slot.products)) {
        slot.products.forEach(product => {
          total += (product.price || 0) * (product.quantity || 1)
        })
      }
    })
    this.setData({ calculatedTotalPrice: total })
    return total
  },

  async onLoad(options) {
    if (!checkAdminAccess()) return;
    await this.loadCategories()
    if (options.id) {
      this.setData({
        isEdit: true,
        id: options.id
      })
      this.loadPackageDetail(options.id)
    }
  },

  async loadCategories() {
    try {
      const result = await adminApi.getCategories({ page: 1, size: 100 })
      const categories = (result.records || []).map(cat => ({
        label: cat.name,
        value: cat._id,
        _id: cat._id,
        name: cat.name
      }))
      this.setData({ categories })
      this.syncCanAddSlot()
    } catch (error) {
      console.error('加载分类失败:', error)
      wx.showToast({ title: '加载分类失败', icon: 'none' })
    }
  },

  // 构建带禁用状态的分类列表
  buildPickerCategories(currentSlotIndex) {
    const usedCategoryIds = new Set(
      (this.data.formData.template || [])
        .map((slot, index) => (index === currentSlotIndex ? '' : slot.categoryId))
        .filter(Boolean)
    )
    return (this.data.categories || []).map(cat => ({
      ...cat,
      disabled: usedCategoryIds.has(cat._id)
    }))
  },

  // 同步是否可以添加分类的状态
  syncCanAddSlot() {
    const maxSlots = (this.data.categories || []).length
    const currentSlots = (this.data.formData.template || []).length
    this.setData({ canAddSlot: maxSlots > 0 && currentSlots < maxSlots })
  },

  async loadProductsByCategory(categoryId, forceReload = false) {
    if (!forceReload && this.data.productsByCategory[categoryId]) {
      return this.data.productsByCategory[categoryId]
    }
    
    try {
      const result = await productApi.adminGetList({ 
        page: 1, 
        size: 100, 
        category: categoryId 
      })
      const products = (result.records || []).map(p => ({
        _id: p._id,
        id: p._id,
        name: p.name,
        price: this.normalizeFen(p.price),  // 统一转换为分
        thumb: p.thumb || p.imageUrl
      }))
      
      const productsByCategory = { ...this.data.productsByCategory }
      productsByCategory[categoryId] = products
      this.setData({ productsByCategory })
      
      return products
    } catch (error) {
      console.error('加载商品失败:', error)
      return []
    }
  },

  async loadPackageDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' })
      const pkg = await packageApi.adminGetDetail({ id })

      const imageUrl = pkg.imageUrl || ''
      
      // 使用 normalizeTemplate 处理模板数据，兼容新旧格式
      let template = this.normalizeTemplate(pkg.template || [])

      // 补充分类名称（商品信息已在套餐保存时存储，无需预加载）
      template = template.map(item => ({
        ...item,
        categoryName: item.categoryName || this.getCategoryName(item.categoryId)
      }))

      // 注意：云函数 getPackageDetail 已将价格从"分"转换为"元"，无需再次转换
      this.setData({
        formData: {
          name: pkg.name || '',
          description: pkg.description || '',
          type: 'white', // 固定为白事类型
          imageUrl: imageUrl,
          status: pkg.status !== undefined ? pkg.status : 1,
          sort: pkg.sort || 0,
          template: template
        },
        fileList: imageUrl ? [{ url: imageUrl }] : []
      })

      // 计算总价
      this.calculateTotalPrice()

      wx.hideLoading()
    } catch (error) {
      wx.hideLoading()
      console.error('加载套餐详情失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  getCategoryName(categoryId) {
    const category = this.data.categories.find(c => c._id === categoryId)
    return category ? category.name : '未知分类'
  },

  onStatusChange(e) {
    this.setData({ 'formData.status': e.detail.value ? 1 : 0 })
  },

  // 图片上传
  async onSelectImage() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (res.tempFilePaths.length > 0) {
        this.uploadImage(res.tempFilePaths[0])
      }
    } catch (error) {
      console.log('用户取消选择或发生错误', error)
    }
  },

  async uploadImage(filePath) {
    try {
      wx.showLoading({ title: '上传中...' })

      const cloudPath = `packages/${Date.now()}-${Math.random().toString(36).slice(2)}.${filePath.split('.').pop()}`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      })

      const fileID = uploadResult.fileID

      this.setData({
        'formData.imageUrl': fileID,
        fileList: [{ url: fileID }]
      })

      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      console.error('图片上传失败:', error)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  onRemoveImage() {
    this.setData({
      fileList: [],
      'formData.imageUrl': ''
    })
  },

  // 提交表单
  async onSubmit() {
    const { formData, isEdit, id, calculatedTotalPrice } = this.data

    if (!formData.name) {
      wx.showToast({ title: '请输入套餐名称', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    try {
      wx.showLoading({ title: '保存中...' })

      // 计算最新的商品总价，直接作为套餐价格
      const totalFen = calculatedTotalPrice || this.calculateTotalPrice()
      const priceFen = totalFen

      // 转换价格为分，使用新的模板格式
      const submitData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        price: priceFen,
        discountPrice: null,
        imageUrl: formData.imageUrl,
        status: formData.status,
        sort: formData.sort,
        template: formData.template.map(item => ({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          products: (item.products || []).map(p => ({
            productId: p.productId,
            productName: p.productName,
            price: p.price || 0,
            quantity: p.quantity || 1,
            imageUrl: p.imageUrl || ''
          }))
        }))
      }

      if (isEdit) {
        await packageApi.update({ id, ...submitData })
      } else {
        await packageApi.create(submitData)
      }

      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        success: () => {
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      })
    } catch (error) {
      wx.hideLoading()
      this.setData({ saving: false })
      console.error('保存失败:', error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ========== WXML 绑定的方法别名和新增方法 ==========

  // 通用输入变更处理
  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`formData.${field}`]: value })
  },

  // 选择图片（WXML 绑定名称）
  chooseImage() {
    this.onSelectImage()
  },

  // 删除图片（WXML 绑定名称）
  deleteImage() {
    this.onRemoveImage()
  },

  // 添加模板分类（WXML 绑定名称）- 使用新格式
  addTemplateSlot() {
    if (!this.data.canAddSlot) {
      wx.showToast({ title: '分类已达上限', icon: 'none' })
      return
    }
    const template = [...this.data.formData.template]
    template.push({
      categoryId: '',
      categoryName: '',
      products: []  // 新格式：使用products数组
    })
    this.setData({ 'formData.template': template })
    this.syncCanAddSlot()
  },

  // 向指定分类添加商品
  async addProductToSlot(e) {
    const slotIndex = e.currentTarget.dataset.slotIndex
    const currentSlot = this.data.formData.template[slotIndex]
    
    if (!currentSlot || !currentSlot.categoryId) {
      wx.showToast({ title: '请先选择分类', icon: 'none' })
      return
    }

    const products = await this.loadProductsByCategory(currentSlot.categoryId, true)
    this.setData({
      showProductModal: true,
      currentSlotIndex: slotIndex,
      categoryProducts: products,
      selectedProductId: ''
    })
  },

  // 从分类中移除商品
  removeProductFromSlot(e) {
    const { slotIndex, productIndex } = e.currentTarget.dataset
    const template = [...this.data.formData.template]
    
    if (template[slotIndex] && template[slotIndex].products) {
      template[slotIndex].products.splice(productIndex, 1)
      this.setData({ 'formData.template': template })
      this.calculateTotalPrice()
    }
  },

  // 调整商品数量
  updateProductQuantity(e) {
    const { slotIndex, productIndex, delta } = e.currentTarget.dataset
    const template = [...this.data.formData.template]
    
    if (template[slotIndex] && template[slotIndex].products && template[slotIndex].products[productIndex]) {
      const currentQty = template[slotIndex].products[productIndex].quantity || 1
      const newQty = Math.max(1, currentQty + parseInt(delta))
      template[slotIndex].products[productIndex].quantity = newQty
      this.setData({ 'formData.template': template })
      this.calculateTotalPrice()
    }
  },

  // 移除模板分类（WXML 绑定名称）
  removeTemplateSlot(e) {
    const index = e.currentTarget.dataset.index
    const template = [...this.data.formData.template]
    template.splice(index, 1)
    this.setData({ 'formData.template': template })
    this.calculateTotalPrice()
    this.syncCanAddSlot()
  },

  // 显示分类选择弹窗
  showCategoryPicker(e) {
    const index = e.currentTarget.dataset.index
    const currentItem = this.data.formData.template[index]
    const pickerCategories = this.buildPickerCategories(index)
    this.setData({
      showCategoryModal: true,
      currentSlotIndex: index,
      selectedCategoryId: currentItem ? currentItem.categoryId : '',
      pickerCategories: pickerCategories
    })
  },

  // 隐藏分类选择弹窗
  hideCategoryPicker() {
    this.setData({ showCategoryModal: false })
  },

  // 选择分类
  selectCategory(e) {
    const item = e.currentTarget.dataset.item
    if (item.disabled) return
    const index = this.data.currentSlotIndex
    
    if (index >= 0) {
      this.setData({
        [`formData.template[${index}].categoryId`]: item._id,
        [`formData.template[${index}].categoryName`]: item.name,
        [`formData.template[${index}].defaultProductId`]: '',
        [`formData.template[${index}].defaultProductName`]: '',
        [`formData.template[${index}].products`]: [],
        showCategoryModal: false,
        selectedCategoryId: item._id
      })
      this.calculateTotalPrice()
      this.syncCanAddSlot()
    }
  },

  // 隐藏商品选择弹窗
  hideProductPicker() {
    this.setData({ showProductModal: false })
  },

  // 选择商品 - 更新为添加到products数组
  selectProduct(e) {
    const item = e.currentTarget.dataset.item
    const index = this.data.currentSlotIndex
    
    if (index >= 0) {
      const template = [...this.data.formData.template]
      if (!template[index].products) {
        template[index].products = []
      }
      
      // 检查是否已存在该商品
      const existingIndex = template[index].products.findIndex(p => p.productId === item._id)
      if (existingIndex >= 0) {
        // 已存在则增加数量
        template[index].products[existingIndex].quantity += 1
      } else {
        // 不存在则添加新商品
        // 注意：item.price 已经在 loadProductsByCategory 中被转换为"分"了，不需要再转换
        template[index].products.push({
          productId: item._id,
          productName: item.name,
          price: item.price || 0,
          quantity: 1,
          imageUrl: item.thumb || ''
        })
      }
      
      this.setData({
        'formData.template': template,
        showProductModal: false,
        selectedProductId: item._id
      })
      this.calculateTotalPrice()
    }
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空方法，仅用于阻止事件冒泡
  },

  // 取消编辑
  onCancel() {
    wx.navigateBack()
  },

  // 保存（WXML 绑定名称，调用 onSubmit）
  onSave() {
    this.onSubmit()
  }
})
