const { adminApi } = require('../../../../utils/api.js');
const validation = require('../../../../utils/validation.js');
const { SYSTEM_TYPE, CURRENT_SYSTEM_TYPE } = require('../../../../config/constants.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');

const MAX_GALLERY_IMAGES = 9;

function uniqueImageUrls(list = []) {
    return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
}

Page({
    data: {
        isEdit: false,
        id: null,
        formData: {
            name: '',
            price: '',
            costPrice: '',
            stock: '',
            category: '',  // 改为category，存储分类_id
            description: '',
            status: 1,
            thumb: '',
            imageUrl: '',
            coverImage: '',
            galleryImages: [],
            images: [],
            // [殡葬平台转型] 商品类型默认固定为 WHITE
            type: CURRENT_SYSTEM_TYPE
        },
        fileList: [],
        coverIndex: -1,
        categories: [],
        categoryVisible: false,
        selectedCategoryName: ''
    },

    async onLoad(options) {
        if (!checkAdminAccess()) return
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

            const legacyCover = product.thumb || product.imageUrl || '';
            const canonicalCover = product.coverImage || '';
            const resolvedCover = canonicalCover || legacyCover;
            const canonicalGallery = Array.isArray(product.galleryImages) ? product.galleryImages : [];
            const canonicalImages = Array.isArray(product.images) ? product.images : [];
            const fallbackGallery = canonicalImages.filter(url => url && url !== resolvedCover);
            const mergedImages = uniqueImageUrls(
                resolvedCover
                    ? [resolvedCover, ...(canonicalGallery.length ? canonicalGallery : fallbackGallery)]
                    : (canonicalGallery.length ? canonicalGallery : canonicalImages)
            ).slice(0, MAX_GALLERY_IMAGES);
            const coverIndex = mergedImages.length > 0 ? 0 : -1;
            const fileList = mergedImages.map(url => ({ url }));

            this.setData({
                formData: {
                    name: product.name,
                    price: product.price,
                    costPrice: product.costPrice ?? product.originalPrice ?? '',
                    stock: product.stock,
                    category: product.category,  // 使用category字段
                    description: product.description,
                    status: product.status,
                    thumb: resolvedCover,
                    imageUrl: resolvedCover,
                    coverImage: resolvedCover,
                    galleryImages: mergedImages.slice(1),
                    images: mergedImages,
                    // [殡葬平台转型] 编辑态仍固定提交 WHITE 类型
                    type: CURRENT_SYSTEM_TYPE
                },
                fileList,
                coverIndex
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

    onCostPriceChange(e) {
        this.setData({ 'formData.costPrice': e.detail.value });
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

    composeImagePayload(fileList = [], coverIndex = -1) {
        const normalizedFiles = uniqueImageUrls((fileList || []).map(item => item && item.url))
            .slice(0, MAX_GALLERY_IMAGES)
            .map(url => ({ url }));

        const normalizedCoverIndex = normalizedFiles.length === 0
            ? -1
            : Math.min(Math.max(coverIndex, 0), normalizedFiles.length - 1);

        const coverImage = normalizedCoverIndex >= 0
            ? normalizedFiles[normalizedCoverIndex].url
            : '';
        const galleryImages = normalizedFiles
            .filter((_, index) => index !== normalizedCoverIndex)
            .map(item => item.url);
        const images = coverImage ? [coverImage, ...galleryImages] : [...galleryImages];

        return {
            fileList: normalizedFiles,
            coverIndex: normalizedCoverIndex,
            coverImage,
            galleryImages,
            images,
            thumb: coverImage,
            imageUrl: coverImage
        };
    },

    syncImageFields(fileList = this.data.fileList, coverIndex = this.data.coverIndex) {
        const payload = this.composeImagePayload(fileList, coverIndex);
        this.setData({
            fileList: payload.fileList,
            coverIndex: payload.coverIndex,
            'formData.coverImage': payload.coverImage,
            'formData.galleryImages': payload.galleryImages,
            'formData.images': payload.images,
            'formData.thumb': payload.thumb,
            'formData.imageUrl': payload.imageUrl
        });
    },

    async onSelectImage() {
        const remainCount = MAX_GALLERY_IMAGES - this.data.fileList.length;
        if (remainCount <= 0) {
            wx.showToast({ title: '最多上传9张图片', icon: 'none' });
            return;
        }

        try {
            const res = await wx.chooseImage({
                count: remainCount,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
            });

            if (res.tempFilePaths && res.tempFilePaths.length > 0) {
                const croppedFilePaths = await this.prepareSquareImages(res.tempFilePaths);
                if (croppedFilePaths.length > 0) {
                    await this.uploadImages(croppedFilePaths);
                }
            }
        } catch (error) {
            console.log('用户取消选择或发生错误', error);
        }
    },

    cropImageToSquare(filePath) {
        return new Promise((resolve, reject) => {
            if (typeof wx.cropImage !== 'function') {
                resolve(filePath);
                return;
            }

            wx.cropImage({
                src: filePath,
                cropScale: '1:1',
                success: (res) => {
                    resolve(res.tempFilePath || filePath);
                },
                fail: (error) => {
                    if (error && (error.errMsg || '').includes('cancel')) {
                        resolve('');
                        return;
                    }
                    reject(error);
                }
            });
        });
    },

    async prepareSquareImages(tempFilePaths = []) {
        if (!Array.isArray(tempFilePaths) || tempFilePaths.length === 0) {
            return [];
        }

        if (typeof wx.cropImage !== 'function') {
            wx.showToast({ title: '请尽量选择方形图片', icon: 'none' });
            return tempFilePaths;
        }

        const croppedFilePaths = [];
        for (const filePath of tempFilePaths) {
            const croppedFilePath = await this.cropImageToSquare(filePath);
            if (croppedFilePath) {
                croppedFilePaths.push(croppedFilePath);
            }
        }

        if (croppedFilePaths.length === 0) {
            wx.showToast({ title: '已取消裁剪', icon: 'none' });
        }

        return croppedFilePaths;
    },

    async uploadImages(tempFilePaths = []) {
        if (!Array.isArray(tempFilePaths) || tempFilePaths.length === 0) {
            return;
        }

        try {
            wx.showLoading({ title: '上传中...' });
            const uploadedFiles = [];

            for (const filePath of tempFilePaths) {
                const fileID = await this.uploadSingleImage(filePath);
                uploadedFiles.push({ url: fileID });
            }

            const nextFileList = [...this.data.fileList, ...uploadedFiles].slice(0, MAX_GALLERY_IMAGES);
            this.syncImageFields(nextFileList, this.data.coverIndex);

            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (error) {
            wx.hideLoading();
            console.error('图片上传失败:', error);
            wx.showToast({ title: '上传失败', icon: 'none' });
        }
    },

    async uploadSingleImage(filePath) {
        const fileExt = (filePath.split('.').pop() || 'jpg').toLowerCase();
        const cloudPath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const uploadResult = await wx.cloud.uploadFile({
            cloudPath,
            filePath
        });
        return uploadResult.fileID;
    },

    onPreviewImage(e) {
        const index = Number(e.currentTarget.dataset.index);
        const urls = this.data.fileList.map(item => item.url).filter(Boolean);
        if (urls.length === 0) {
            return;
        }

        wx.previewImage({
            current: urls[index] || urls[0],
            urls
        });
    },

    onSetCover(e) {
        const index = Number(e.currentTarget.dataset.index);
        if (Number.isNaN(index) || index < 0 || index >= this.data.fileList.length) {
            return;
        }
        this.syncImageFields(this.data.fileList, index);
    },

    onRemoveImage(e) {
        const index = Number(e.currentTarget.dataset.index);
        if (Number.isNaN(index) || index < 0 || index >= this.data.fileList.length) {
            return;
        }

        const nextFileList = this.data.fileList.filter((_, fileIndex) => fileIndex !== index);
        let nextCoverIndex = this.data.coverIndex;
        if (index === nextCoverIndex) {
            nextCoverIndex = nextFileList.length > 0 ? 0 : -1;
        } else if (index < nextCoverIndex) {
            nextCoverIndex -= 1;
        }

        this.syncImageFields(nextFileList, nextCoverIndex);
    },

    async onSubmit() {
        const { formData, isEdit, id, fileList, coverIndex } = this.data;

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

            const imagePayload = this.composeImagePayload(fileList, coverIndex);
            const payload = {
                ...formData,
                // [殡葬平台转型] 强制类型为 WHITE
                type: CURRENT_SYSTEM_TYPE,
                coverImage: imagePayload.coverImage,
                galleryImages: imagePayload.galleryImages,
                images: imagePayload.images,
                thumb: imagePayload.thumb,
                imageUrl: imagePayload.imageUrl
            };

            if (isEdit) {
                await adminApi.updateProduct(id, payload);
            } else {
                await adminApi.createProduct(payload);
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
