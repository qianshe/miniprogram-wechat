const app = getApp();
const { adminApi } = require('../../../../utils/api.js');

Page({
  data: {
    isEdit: false,
    categoryId: '',
    isSubmitting: false,
    formData: {
      name: '',
      type: 'white',
      sort: 1,
      description: '',
      status: 1,
      productCount: 0
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        categoryId: options.id
      });
      wx.setNavigationBarTitle({ title: '编辑分类' });
      this.loadCategoryDetail(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增分类' });
    }
  },

  // 加载分类详情
  async loadCategoryDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const data = await adminApi.getCategoryDetail(id);
      wx.hideLoading();

      if (data) {
        this.setData({
          formData: {
            name: data.name || '',
            type: data.type || 'white',
            sort: data.sort || 1,
            description: data.description || '',
            status: data.status !== undefined ? data.status : 1,
            productCount: data.productCount || 0
          }
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取分类详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 分类名称变化
  onNameChange(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 分类类型变化
  onTypeChange(e) {
    this.setData({
      'formData.type': e.detail.value
    });
  },

  // 排序变化
  onSortChange(e) {
    this.setData({
      'formData.sort': e.detail.value
    });
  },

  // 描述变化
  onDescriptionChange(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 状态变化
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value
    });
  },

  // 表单验证
  validateForm() {
    const { name, type } = this.data.formData;

    if (!name || !name.trim()) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      });
      return false;
    }

    if (!type) {
      wx.showToast({
        title: '请选择分类类型',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) {
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const { formData, isEdit, categoryId } = this.data;
      
      if (isEdit) {
        // 编辑模式
        await adminApi.updateCategory(categoryId, {
          name: formData.name.trim(),
          sort: formData.sort,
          description: formData.description,
          status: formData.status
        });
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        // 新增模式
        await adminApi.createCategory({
          name: formData.name.trim(),
          type: formData.type,
          sort: formData.sort,
          description: formData.description
        });
        
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });
      }

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('保存分类失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});