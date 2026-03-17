const { api } = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const authGuard = require('../../../utils/authGuard.js');

const DEFAULT_PRODUCT_IMAGE = 'https://tdesign.gtimg.com/mobile/demos/example1.png';

Page({
  data: {
    id: '',
    loading: true,
    goods: null,
    systemType: 'white',
    categoryName: ''
  },

  onLoad(options) {
    const { id, systemType } = options;
    const themeType = systemType || 'white';

    if (id) {
      this.setData({
        id,
        systemType: themeType
      });
      this.loadGoodsDetail(id);
    }
  },

  async resolveCategoryName(goods) {
    const categoryId = goods.category || goods.categoryId || '';
    let resolvedCategoryName = goods.categoryName || '';

    if (!categoryId) {
      return resolvedCategoryName;
    }

    try {
      const categoryDetail = await api.getCategoryDetail(categoryId);
      if (categoryDetail && categoryDetail.name) {
        return categoryDetail.name;
      }

      const categories = await api.getCategories({ page: 1, size: 100, status: 1 });
      const matchedCategory = (categories || []).find((item) => {
        return item && (item._id === categoryId || item.id === categoryId);
      });

      if (matchedCategory && matchedCategory.name) {
        return matchedCategory.name;
      }
    } catch (error) {
      console.warn('[goods/detail] Resolve category failed:', error);
    }

    return resolvedCategoryName;
  },

  async loadGoodsDetail(id) {
    try {
      this.setData({ loading: true });
      wx.showLoading({ title: '加载中' });
      const goods = await api.getProductDetail(id);
      const categoryName = await this.resolveCategoryName(goods);
      const parsedPrice = Number(goods.price || 0);
      const imageCandidates = [
        goods.coverImage,
        ...(Array.isArray(goods.galleryImages) ? goods.galleryImages : []),
        ...(Array.isArray(goods.images) ? goods.images : []),
        goods.thumb,
        goods.imageUrl,
        goods.image
      ].filter(Boolean);
      const normalizedImages = [...new Set(imageCandidates)];
      if (normalizedImages.length === 0) {
        normalizedImages.push(DEFAULT_PRODUCT_IMAGE);
      }
      const goodsData = {
        ...goods,
        price: parsedPrice,
        displayPrice: parsedPrice.toFixed(2),
        displayTime: goods.createTime ? new Date(goods.createTime).toLocaleString() : '',
        image: normalizedImages[0] || DEFAULT_PRODUCT_IMAGE,
        images: normalizedImages
      };

      this.setData({
        goods: goodsData,
        categoryName: categoryName || '',
        loading: false
      });
      wx.hideLoading();
    } catch (err) {
      console.error('[goods/detail] Load goods detail failed:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  contactService() {
    // 咨询服务 - 引导用户通过联系方式咨询
    wx.showModal({
      title: '咨询详情',
      content: '如需了解更多商品信息，请联系我们的客服人员。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '拨打电话',
      success: (res) => {
        if (res.confirm) {
          // 获取配置的联系电话
          const contactConfig = require('../../../config/contact.js');
          const phone = contactConfig.servicePhone || '';
          if (phone) {
            wx.makePhoneCall({
              phoneNumber: phone,
              fail: () => {
                wx.showToast({ title: '拨号失败', icon: 'none' });
              }
            });
          } else {
            wx.showToast({ title: '暂无联系电话', icon: 'none' });
          }
        }
      }
    });
  },

  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls: this.data.goods.images
    });
  }
});
