const { adminApi } = require('../../../../utils/api.js');

Page({
    data: {
        isEdit: false,
        id: null,
        formData: {
            name: '',
            price: '',
            originalPrice: '',
            stock: '',
            categoryId: '',
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
        this.loadCategories();
        if (options.id) {
            this.setData({
                isEdit: true,
                id: options.id
            });
            this.loadProductDetail(options.id);
        }
    },

    loadCategories() {
        // 模拟分类数据，实际应从API获取
        const categories = [
            { label: '食品饮料', value: 1 },
            { label: '服装鞋包', value: 2 },
            { label: '美妆护肤', value: 3 },
            { label: '家居日用', value: 4 },
            { label: '数码电子', value: 5 }
        ];
        this.setData({ categories });
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
                    categoryId: product.categoryId,
                    description: product.description,
                    status: product.status,
                    thumb: product.thumb
                },
                fileList: product.thumb ? [{ url: product.thumb }] : []
            });

            // 设置选中的分类名称
            const category = this.data.categories.find(c => c.value == product.categoryId);
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
            'formData.categoryId': value[0],
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
