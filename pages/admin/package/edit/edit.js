const packageApi = require('../../../../api/package.js')
const categoryApi = require('../../../../api/category.js')
const productApi = require('../../../../api/product.js')

Page({
  data: {
    isEdit: false,
    id: null,
    formData: {
      name: '',
      description: '',
      type: 'white', // 固定为白事类型
      price: '',
      discountPrice: '',
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
    // 模板配置弹窗
    templateVisible: false,
    currentTemplateIndex: -1,
    currentTemplateItem: null,
    // 分类选择弹窗
    categoryPickerVisible: false,
    showCategoryModal: false,
    selectedCategoryId: '',
    currentSlotIndex: -1,
    // 商品选择弹窗
    productPickerVisible: false,
    showProductModal: false,
    selectedProductId: '',
    categoryProducts: [],
    currentCategoryProducts: [],
    // 价格显示
    priceDisplay: '',
    discountPriceDisplay: '',
    // 保存状态
    saving: false,
    // 套餐总价（动态计算）
    calculatedTotalPrice: 0
  },

  // 将旧格式模板数据转换为新格式（兼容性处理）
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
            price: p.price || 0,
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
      const result = await categoryApi.adminGetList({ page: 1, size: 100 })
      const categories = (result.records || []).map(cat => ({
        label: cat.name,
        value: cat._id,
        _id: cat._id,
        name: cat.name
      }))
      this.setData({ categories })
    } catch (error) {
      console.error('加载分类失败:', error)
      wx.showToast({ title: '加载分类失败', icon: 'none' })
    }
  },

  async loadProductsByCategory(categoryId) {
    if (this.data.productsByCategory[categoryId]) {
      return this.data.productsByCategory[categoryId]
    }
    
    try {
      const result = await productApi.adminGetList({ 
        page: 1, 
        size: 100, 
        categoryId: categoryId 
      })
      const products = (result.records || []).map(p => ({
        _id: p._id,
        id: p._id,
        name: p.name,
        price: p.price,
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

      // 补充分类名称
      template = template.map(item => ({
        ...item,
        categoryName: item.categoryName || this.getCategoryName(item.categoryId)
      }))

      // 加载每个模板项中商品的详细信息（价格、图片等）
      for (let i = 0; i < template.length; i++) {
        if (template[i].categoryId) {
          const products = await this.loadProductsByCategory(template[i].categoryId)
          // 更新商品信息
          for (let j = 0; j < template[i].products.length; j++) {
            const productInfo = products.find(p => p._id === template[i].products[j].productId)
            if (productInfo) {
              template[i].products[j].productName = productInfo.name
              template[i].products[j].price = productInfo.price || 0
              template[i].products[j].imageUrl = productInfo.thumb || ''
            }
          }
        }
      }

      this.setData({
        formData: {
          name: pkg.name || '',
          description: pkg.description || '',
          type: 'white', // 固定为白事类型
          price: pkg.price ? (pkg.price / 100).toString() : '',
          discountPrice: pkg.discountPrice ? (pkg.discountPrice / 100).toString() : '',
          imageUrl: imageUrl,
          status: pkg.status !== undefined ? pkg.status : 1,
          sort: pkg.sort || 0,
          template: template
        },
        fileList: imageUrl ? [{ url: imageUrl }] : [],
        priceDisplay: pkg.price ? (pkg.price / 100).toString() : '',
        discountPriceDisplay: pkg.discountPrice ? (pkg.discountPrice / 100).toString() : ''
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

  // 表单字段变更处理
  onNameChange(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  onDescriptionChange(e) {
    this.setData({ 'formData.description': e.detail.value })
  },

  onPriceChange(e) {
    this.setData({ 'formData.price': e.detail.value })
  },

  onDiscountPriceChange(e) {
    this.setData({ 'formData.discountPrice': e.detail.value })
  },

  onSortChange(e) {
    this.setData({ 'formData.sort': parseInt(e.detail.value) || 0 })
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

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  onRemoveImage() {
    this.setData({
      fileList: [],
      'formData.imageUrl': ''
    })
  },

  // 模板配置
  addTemplateItem() {
    this.setData({
      currentTemplateIndex: -1,
      currentTemplateItem: {
        categoryId: '',
        categoryName: '',
        quantity: 1,
        defaultProductId: '',
        defaultProductName: ''
      },
      templateVisible: true
    })
  },

  editTemplateItem(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.formData.template[index]
    this.setData({
      currentTemplateIndex: index,
      currentTemplateItem: { ...item },
      templateVisible: true
    })
  },

  removeTemplateItem(e) {
    const index = e.currentTarget.dataset.index
    const template = [...this.data.formData.template]
    template.splice(index, 1)
    this.setData({ 'formData.template': template })
  },

  onTemplateCancel() {
    this.setData({ templateVisible: false })
  },

  onTemplateSave() {
    const { currentTemplateIndex, currentTemplateItem } = this.data
    
    if (!currentTemplateItem.categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }
    
    if (!currentTemplateItem.quantity || currentTemplateItem.quantity < 1) {
      wx.showToast({ title: '数量至少为1', icon: 'none' })
      return
    }

    const template = [...this.data.formData.template]
    
    if (currentTemplateIndex === -1) {
      // 新增
      template.push(currentTemplateItem)
    } else {
      // 编辑
      template[currentTemplateIndex] = currentTemplateItem
    }

    this.setData({
      'formData.template': template,
      templateVisible: false
    })
  },

  onTemplateQuantityChange(e) {
    this.setData({
      'currentTemplateItem.quantity': parseInt(e.detail.value) || 1
    })
  },

  // 分类选择
  showCategoryPicker() {
    this.setData({ categoryPickerVisible: true })
  },

  onCategoryPickerCancel() {
    this.setData({ categoryPickerVisible: false })
  },

  onSelectCategory(e) {
    const { value, label } = e.currentTarget.dataset
    this.setData({
      'currentTemplateItem.categoryId': value,
      'currentTemplateItem.categoryName': label,
      'currentTemplateItem.defaultProductId': '',
      'currentTemplateItem.defaultProductName': '',
      categoryPickerVisible: false
    })
    
    // 预加载该分类的商品
    this.loadProductsByCategory(value)
  },

  // 商品选择
  async showProductPicker() {
    const categoryId = this.data.currentTemplateItem.categoryId
    if (!categoryId) {
      wx.showToast({ title: '请先选择分类', icon: 'none' })
      return
    }

    const products = await this.loadProductsByCategory(categoryId)
    this.setData({
      currentCategoryProducts: products,
      productPickerVisible: true
    })
  },

  onProductPickerCancel() {
    this.setData({ productPickerVisible: false })
  },

  onSelectProduct(e) {
    const { value, label } = e.currentTarget.dataset
    this.setData({
      'currentTemplateItem.defaultProductId': value,
      'currentTemplateItem.defaultProductName': label,
      productPickerVisible: false
    })
  },

  // 提交表单
  async onSubmit() {
    const { formData, isEdit, id } = this.data

    if (!formData.name) {
      wx.showToast({ title: '请输入套餐名称', icon: 'none' })
      return
    }
    if (!formData.price) {
      wx.showToast({ title: '请输入价格', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    try {
      wx.showLoading({ title: '保存中...' })

      // 转换价格为分，使用新的模板格式
      const submitData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        price: Math.round(parseFloat(formData.price) * 100),
        discountPrice: formData.discountPrice ? Math.round(parseFloat(formData.discountPrice) * 100) : null,
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

  // 价格输入变更处理（覆盖原有方法，支持 data-field）
  onPriceChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    if (field === 'price') {
      this.setData({
        'formData.price': value,
        priceDisplay: value
      })
    } else if (field === 'discountPrice') {
      this.setData({
        'formData.discountPrice': value,
        discountPriceDisplay: value
      })
    }
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
    const template = [...this.data.formData.template]
    template.push({
      categoryId: '',
      categoryName: '',
      products: []  // 新格式：使用products数组
    })
    this.setData({ 'formData.template': template })
  },

  // 向指定分类添加商品
  async addProductToSlot(e) {
    const slotIndex = e.currentTarget.dataset.slotIndex
    const currentSlot = this.data.formData.template[slotIndex]
    
    if (!currentSlot || !currentSlot.categoryId) {
      wx.showToast({ title: '请先选择分类', icon: 'none' })
      return
    }

    const products = await this.loadProductsByCategory(currentSlot.categoryId)
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
  },

  // 模板数量变更（更新版本，支持直接修改 template 数组）
  onTemplateQuantityChange(e) {
    const index = e.currentTarget.dataset.index
    const value = parseInt(e.detail.value) || 1
    this.setData({ [`formData.template[${index}].quantity`]: value })
  },

  // 显示分类选择弹窗
  showCategoryPicker(e) {
    const index = e.currentTarget.dataset.index
    const currentItem = this.data.formData.template[index]
    this.setData({
      showCategoryModal: true,
      currentSlotIndex: index,
      selectedCategoryId: currentItem ? currentItem.categoryId : ''
    })
  },

  // 隐藏分类选择弹窗
  hideCategoryPicker() {
    this.setData({ showCategoryModal: false })
  },

  // 选择分类
  selectCategory(e) {
    const item = e.currentTarget.dataset.item
    const index = this.data.currentSlotIndex
    
    if (index >= 0) {
      this.setData({
        [`formData.template[${index}].categoryId`]: item._id,
        [`formData.template[${index}].categoryName`]: item.name,
        [`formData.template[${index}].defaultProductId`]: '',
        [`formData.template[${index}].defaultProductName`]: '',
        showCategoryModal: false,
        selectedCategoryId: item._id
      })
      
      // 预加载该分类的商品
      this.loadProductsByCategory(item._id)
    }
  },

  // 显示商品选择弹窗
  async showProductPicker(e) {
    const index = e.currentTarget.dataset.index
    const currentItem = this.data.formData.template[index]
    
    if (!currentItem || !currentItem.categoryId) {
      wx.showToast({ title: '请先选择分类', icon: 'none' })
      return
    }

    const products = await this.loadProductsByCategory(currentItem.categoryId)
    this.setData({
      showProductModal: true,
      currentSlotIndex: index,
      categoryProducts: products,
      selectedProductId: currentItem.defaultProductId || ''
    })
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