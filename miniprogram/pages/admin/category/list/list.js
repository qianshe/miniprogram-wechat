const app = getApp();
const { adminApi } = require('../../../../utils/api.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');

// 列表项高度配置 (rpx) - 与 list.wxss 中 .category-item 的高度保持同步
const ITEM_HEIGHT_RPX = 240;

Page({
  data: {
    categories: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    isLoading: false,
    keyword: '',
    currentType: '', // '' | 'white' | 'red'
    swipeActions: [
      { text: '编辑', className: 'edit-btn' },
      { text: '删除', className: 'delete-btn' }
    ],
    showDeleteDialog: false,
    deleteCategoryId: '',
    deleteCategoryName: '',
    isSorting: false, // 是否处于排序模式
    itemHeight: ITEM_HEIGHT_RPX,
    itemHeightPx: 0, // 将在 onLoad 中计算
    movableAreaHeight: 0, // 拖拽区域总高度
    dragIndex: -1 // 当前拖拽的索引
  },

  onLoad(options) {
    if (!checkAdminAccess()) return;
    // 计算 rpx 到 px 的转换
    const systemInfo = wx.getSystemInfoSync();
    const scale = systemInfo.windowWidth / 750;
    this.setData({
      itemHeightPx: ITEM_HEIGHT_RPX * scale
    });
    this.loadCategories(true);
  },

  onShow() {
    // 每次显示页面时刷新数据（从编辑页返回时）
    if (this.data.categories.length > 0) {
      this.loadCategories(true);
    }
  },

  onPullDownRefresh() {
    this.loadCategories(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore();
    }
  },

  // 加载分类列表
  async loadCategories(reset = false) {
    if (reset) {
      this.setData({
        page: 1,
        categories: [],
        hasMore: true
      });
    }

    if (!this.data.hasMore || this.data.isLoading) {
      return;
    }

    this.setData({ isLoading: true });

    try {
      const params = {
        page: this.data.page,
        size: this.data.pageSize,
        includeProductCount: true
      };

      // 添加类型筛选
      if (this.data.currentType) {
        params.type = this.data.currentType;
      }

      // 获取所有状态的分类（包括禁用的）
      params.status = undefined;

      const data = await adminApi.getCategories(params);
      const { records, total, hasMore } = data;

      // 如果有关键词，进行本地过滤
      let filteredRecords = records;
      if (this.data.keyword) {
        filteredRecords = records.filter(item =>
          item.name.toLowerCase().includes(this.data.keyword.toLowerCase())
        );
      }

      // 计算每个分类的Y轴位置
      const newCategories = reset ? filteredRecords : [...this.data.categories, ...filteredRecords];
      const listWithPos = newCategories.map((item, index) => ({
        ...item,
        y: index * this.data.itemHeight,
        zIndex: 1
      }));

      this.setData({
        categories: listWithPos,
        page: this.data.page + 1,
        hasMore: hasMore,
        isLoading: false,
        total,
        movableAreaHeight: listWithPos.length * this.data.itemHeight
      });
    } catch (error) {
      console.error('获取分类列表失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 加载更多
  loadMore() {
    this.loadCategories();
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    });
  },

  // 搜索确认
  onSearchConfirm() {
    this.loadCategories(true);
  },

  // 搜索清空
  onSearchClear() {
    this.setData({
      keyword: ''
    }, () => {
      this.loadCategories(true);
    });
  },

  // 类型筛选切换
  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      currentType: type
    }, () => {
      this.loadCategories(true);
    });
  },

  // 新增分类
  createCategory() {
    wx.navigateTo({
      url: '/pages/admin/category/edit/edit'
    });
  },

  // 编辑分类
  editCategory(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/category/edit/edit?id=${id}`
    });
  },

  // 切换分类状态（启用/禁用）
  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    const newStatus = currentStatus === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? '启用' : '禁用';

    wx.showModal({
      title: '确认操作',
      content: `确定要${statusText}该分类吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await adminApi.updateCategory(id, { status: newStatus });
            wx.hideLoading();
            wx.showToast({
              title: `${statusText}成功`,
              icon: 'success'
            });
            this.loadCategories(true);
          } catch (error) {
            wx.hideLoading();
            console.error('更新分类状态失败:', error);
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 删除分类（显示确认弹窗）
  deleteCategory(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    this.setData({
      showDeleteDialog: true,
      deleteCategoryId: id,
      deleteCategoryName: name
    });
  },

  // 确认删除
  async confirmDelete() {
    const id = this.data.deleteCategoryId;

    try {
      wx.showLoading({ title: '删除中...' });
      const result = await adminApi.deleteCategory(id);
      wx.hideLoading();

      this.setData({
        showDeleteDialog: false,
        deleteCategoryId: '',
        deleteCategoryName: ''
      });

      // 显示删除结果
      if (result && result.hadProducts) {
        wx.showModal({
          title: '删除成功',
          content: result.notice || '该分类已被禁用',
          showCancel: false
        });
      } else {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      }

      this.loadCategories(true);
    } catch (error) {
      wx.hideLoading();
      console.error('删除分类失败:', error);
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
      this.setData({
        showDeleteDialog: false
      });
    }
  },

  // 切换排序模式
  toggleSort() {
    const newSortingState = !this.data.isSorting;
    
    // 如果是退出排序模式(点击完成按钮)
    if (!newSortingState && this.data.isSorting) {
      // 保存排序
      this.saveSortOrder();
    }
    
    this.setData({
      isSorting: newSortingState
    });
  },

  // 拖拽移动
  onDragChange(e) {
    // 可以添加实时反馈逻辑，但为了性能暂时留空
  },

  // 拖拽结束
  onDragEnd(e) {
    const { y } = e.detail;
    const { index } = e.currentTarget.dataset;
    const { itemHeightPx, itemHeight, categories } = this.data;

    // 使用像素值计算目标索引（e.detail.y 单位是 px）
    let targetIndex = Math.round(y / itemHeightPx);

    // 边界检查
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= categories.length) targetIndex = categories.length - 1;

    if (targetIndex === index) {
      // 位置没变，恢复原位
      this.setData({
        [`categories[${index}].y`]: index * itemHeight,
        [`categories[${index}].zIndex`]: 1
      });
      return;
    }

    // 移动元素
    const list = [...categories];
    const [movedItem] = list.splice(index, 1);
    list.splice(targetIndex, 0, movedItem);

    // 重新计算所有元素位置和排序值
    const updatedList = list.map((item, idx) => ({
      ...item,
      y: idx * itemHeight,
      zIndex: 1,
      sort: idx + 1 // 简单假设排序值为索引+1
    }));

    this.setData({
      categories: updatedList
    });
  },

  // 保存排序顺序
  async saveSortOrder() {
    try {
      wx.showLoading({ title: '保存中...' });
      
      const items = this.data.categories.map((item, index) => ({
        id: item._id,
        sort: index + 1
      }));
      
      await adminApi.batchUpdateSort({ items });
      
      wx.hideLoading();
      wx.showToast({
        title: '排序已更新',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('保存排序失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    }
  },

  // 取消删除
  cancelDelete() {
    this.setData({
      showDeleteDialog: false,
      deleteCategoryId: '',
      deleteCategoryName: ''
    });
  }
});