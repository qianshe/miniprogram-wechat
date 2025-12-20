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

    async onLoad(options) {
        await this.loadCategories();
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

            const thumb = product.thumb || product.imageUrl || '';
            this.setData({
                formData: {
                    name: product.name,
                    price: product.price,
                    originalPrice: product.originalPrice,
                    stock: product.stock,
                    category: product.category,  // 使用category字段
                    description: product.description,
                    status: product.status,
                    thumb: thumb
                },
                fileList: thumb ? [{ url: thumb }] : []
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

    onSelectCategory(e) {
        const { value, label } = e.currentTarget.dataset;
        this.setData({
            'formData.category': value,
            selectedCategoryName: label,
            categoryVisible: false
        });
    },

    onPopupVisibleChange(e) {
        this.setData({ categoryVisible: e.detail.visible });
    },

    onPickerCancel() {
        this.setData({ categoryVisible: false });
    },

    async onSelectImage() {
        try {
            const res = await wx.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
            });

            if (res.tempFilePaths.length > 0) {
                this.uploadImage(res.tempFilePaths[0]);
            }
        } catch (error) {
            console.log('用户取消选择或发生错误', error);
        }
    },

    async uploadImage(filePath) {
        try {
            wx.showLoading({ title: '上传中...' });

            // 上传到云存储
            const cloudPath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${filePath.split('.').pop()}`;
            const uploadResult = await wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: filePath
            });

            // 获取文件ID
            const fileID = uploadResult.fileID;

            // 单图模式：新图片替换旧图片
            this.setData({
                'formData.thumb': fileID,
                fileList: [{ url: fileID }]
            });

            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (error) {
            wx.hideLoading();
            console.error('图片上传失败:', error);
            wx.showToast({ title: '上传失败', icon: 'none' });
        }
    },

    onPreviewImage(e) {
        const url = e.currentTarget.dataset.url;
        wx.previewImage({
            current: url,
            urls: [url]
        });
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
