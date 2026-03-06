const { adminApi } = require('../../../../utils/api.js');
const validation = require('../../../../utils/validation.js');
const { checkAdminAccess } = require('../../../../utils/adminGuard.js');

Page({
    data: {
        isEdit: false,
        id: null,
        formData: {
            name: '',
            price: '',
            originalPrice: '',
            stock: '',
            category: '',  // 改为category，存储分类_id
            description: '',
            status: 1,
            thumb: ''
        },
        fileList: [],
        categories: [],
        categoryVisible: false,
        selectedCategoryName: ''
    },

    onLoad(options) {
        if (!checkAdminAccess()) return
        this.loadCategories();
        if (options.id) {
            this.setData({
                isEdit: true,
                id: options.id
            });
            this.loadProductDetail(options.id);
        }
    },

    async loadCategories() {
        try {
            // 从云函数获取分类列表
            const result = await adminApi.getCategories({ page: 1, size: 100 });
            const categories = (result.records || []).map(cat => ({
                label: cat.name,
                value: cat._id  // 使用_id作为value
            }));
            this.setData({ categories });
        } catch (error) {
            console.error('加载分类失败:', error);
            wx.showToast({ title: '加载分类失败', icon: 'none' });
        }
    },

    async loadProductDetail(id) {
        try {
            wx.showLoading({ title: '加载中...' });
            const product = await adminApi.getProductDetail(id);

            this.setData({
                formData: {
                    name: product.name,
                    price: product.price,
                    originalPrice: product.originalPrice,
                    stock: product.stock,
                    category: product.category,  // 使用category字段
                    description: product.description,
                    status: product.status,
                    thumb: product.thumb
                },
                fileList: product.thumb ? [{ url: product.thumb }] : []
            });

            // 设置选中的分类名称
            const category = this.data.categories.find(c => c.value === product.category);
            if (category) {
                this.setData({ selectedCategoryName: category.label });
            }

            wx.hideLoading();
        } catch (error) {
            wx.hideLoading();
            console.error('加载商品详情失败:', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    onNameChange(e) {
        this.setData({ 'formData.name': e.detail.value });
    },

    onPriceChange(e) {
        this.setData({ 'formData.price': e.detail.value });
    },

    onOriginalPriceChange(e) {
        this.setData({ 'formData.originalPrice': e.detail.value });
    },

    onStockChange(e) {
        this.setData({ 'formData.stock': e.detail.value });
    },

    onDescriptionChange(e) {
        this.setData({ 'formData.description': e.detail.value });
    },

    onStatusChange(e) {
        this.setData({ 'formData.status': e.detail.value ? 1 : 0 });
    },

    onCategoryPicker() {
        this.setData({ categoryVisible: true });
    },

    onCategoryChange(e) {
        const { value, label } = e.detail;
        this.setData({
            'formData.category': value[0],  // 改为category
            selectedCategoryName: label[0],
            categoryVisible: false
        });
    },

    onPickerCancel() {
        this.setData({ categoryVisible: false });
    },

    onAddImage(e) {
        const { files } = e.detail;
        this.setData({
            fileList: files
        });
        // 这里应该处理图片上传，获取服务器URL
        // 模拟上传成功
        if (files.length > 0) {
            this.setData({ 'formData.thumb': files[0].url });
        }
    },

    onRemoveImage(e) {
        this.setData({
            fileList: [],
            'formData.thumb': ''
        });
    },

    async onSubmit() {
        const { formData, isEdit, id } = this.data;

        if (!formData.name) {
            wx.showToast({ title: '请输入商品名称', icon: 'none' });
            return;
        }
        if (!formData.price) {
            wx.showToast({ title: '请输入价格', icon: 'none' });
            return;
        }

        // 敏感词预校验
        const nameCheck = validation.checkSensitiveWords(formData.name);
        if (!nameCheck.valid) {
            wx.showToast({
                title: '商品信息包含敏感词，请修改',
                icon: 'none'
            });
            return;
        }
        if (formData.description) {
            const descCheck = validation.checkSensitiveWords(formData.description);
            if (!descCheck.valid) {
                wx.showToast({
                    title: '商品信息包含敏感词，请修改',
                    icon: 'none'
                });
                return;
            }
        }

        try {
            wx.showLoading({ title: '保存中...' });

            if (isEdit) {
                await adminApi.updateProduct(id, formData);
            } else {
                await adminApi.createProduct(formData);
            }

            wx.hideLoading();
            wx.showToast({
                title: '保存成功',
                icon: 'success',
                success: () => {
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                }
            });
        } catch (error) {
            wx.hideLoading();
            console.error('保存失败:', error);
            wx.showToast({ title: '保存失败', icon: 'none' });
        }
    }
});