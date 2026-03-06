const app = getApp();
const { adminApi } = require('../../../../utils/api.js');
const productApi = require('../../../../api/product.js');
const { checkAdminAccess } = require('../../../../utils/adminGuard.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    products: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    isLoading: false,
    keyword: '',
    showFilterPanel: false,
    filterParams: {
      priceMin: '',
      priceMax: '',
      categoryId: ''
    },
    categories: [],
    categoryOptions: [],
    selectedCategoryId: '',
    selectedCategoryName: '',
    categoryVisible: false,
    orderBy: 'createTime', // createTime, sales, price
    orderDirection: 'desc' // asc, desc
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!checkAdminAccess()) return
    this.loadCategories()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadProducts(true)
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  async onPullDownRefresh() {
    try {
      await this.resetAndLoad()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore()
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载商品分类
   */
  async loadCategories() {
    try {
      // 从云函数获取分类列表
      const result = await adminApi.getCategories({ page: 1, size: 100 });
      const categories = result.records || [];

      // 转换为下拉菜单格式
      const categoryOptions = [
        { label: '全部分类', value: '' },
        ...categories.map(item => ({
          label: item.name,
          value: item._id
        }))
      ];

      this.setData({
        categories,
        categoryOptions
      });
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({ title: '加载分类失败', icon: 'none' });
    }
  },

  /**
   * 加载商品列表
   */
  loadProducts(reset = false) {
    if (reset) {
      this.setData({
        page: 1,
        products: [],
        hasMore: true
      })
    }

    if (!this.data.hasMore || this.data.isLoading) {
      return
    }

    this.setData({
      isLoading: true
    })

    // 构建查询参数
    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize,
      keyword: this.data.keyword,
      orderBy: this.data.orderBy,
      orderDirection: this.data.orderDirection,
      categoryId: this.data.selectedCategoryId,
      ...this.data.filterParams
    }

    // 调用统一API获取商品数据
    adminApi.getProducts({
      page: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      orderBy: params.orderBy,
      orderDirection: params.orderDirection,
      ...params
    })
      .then(data => {
        const { records, total } = data;
        const hasMore = params.page * params.pageSize < total;
        const newPage = this.data.page + 1;

        // 处理字段映射 (兼容 _id/id 和 imageUrl/thumb)
        const processedRecords = records.map(item => ({
          ...item,
          id: item._id || item.id,  // 将 _id 映射为 id
          thumb: item.thumb || item.imageUrl || ''
        }));

        this.setData({
          products: reset ? processedRecords : [...this.data.products, ...processedRecords],
          page: newPage,
          hasMore,
          isLoading: false,
          total
        });
      })
      .catch(err => {
        console.error('获取商品列表失败:', err);
        this.setData({
          isLoading: false
        });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },


  /**
   * 加载更多商品
   */
  loadMore() {
    this.loadProducts()
  },

  /**
   * 重置并重新加载
   */
  resetAndLoad() {
    this.loadProducts(true)
  },

  /**
   * TDesign搜索框变化
   */
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  /**
   * TDesign搜索框清空
   */
  onSearchClear() {
    this.setData({
      keyword: ''
    }, () => {
      this.resetAndLoad();
    });
  },

  onSearchConfirm() {
    this.resetAndLoad()
  },

  /**
   * 显示分类选择器
   */
  showCategoryPicker() {
    this.setData({ categoryVisible: true });
  },

  /**
   * 隐藏分类选择器
   */
  onPickerCancel() {
    this.setData({ categoryVisible: false });
  },

  /**
   * 选择分类
   */
  onSelectCategory(e) {
    const { value, label } = e.currentTarget.dataset;
    this.setData({
      selectedCategoryId: value,
      selectedCategoryName: label === '全部分类' ? '' : label,
      categoryVisible: false
    }, () => {
      this.resetAndLoad();
    });
  },

  /**
   * 排序方式改变
   */
  changeOrderBy(e) {
    const orderBy = e.currentTarget.dataset.orderby

    // 如果点击相同排序字段，切换排序方向
    if (this.data.orderBy === orderBy) {
      this.setData({
        orderDirection: this.data.orderDirection === 'asc' ? 'desc' : 'asc'
      })
    } else {
      // 如果点击不同排序字段，设置新的排序字段，默认为降序
      this.setData({
        orderBy,
        orderDirection: 'desc'
      })
    }

    this.resetAndLoad()
  },

  /**
   * 创建新商品
   */
  createProduct() {
    wx.navigateTo({
      url: '/pages/admin/product/edit/edit',
    })
  },

  /**
   * 编辑商品
   */
  editProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/product/edit/edit?id=${id}`,
    })
  },

  /**
   * 查看商品详情
   */
  viewProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${id}`,
    })
  },

  /**
   * 上架/下架商品
   */
  async toggleProductStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 1 ? 0 : 1

    wx.showModal({
      title: '确认操作',
      content: newStatus === 1 ? '确定要上架该商品吗？' : '确定要下架该商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' })
            
            await adminApi.updateProduct(id, { status: newStatus })
            
            wx.hideLoading()
            
            const products = this.data.products.map(item => {
              if (item.id === id || item._id === id) {
                return { ...item, status: newStatus }
              }
              return item
            })

            this.setData({ products })

            wx.showToast({
              title: newStatus === 1 ? '上架成功' : '下架成功',
              icon: 'success'
            })
          } catch (error) {
            wx.hideLoading()
            console.error('更新商品状态失败:', error)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * 删除商品
   */
  async deleteProduct(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该商品吗？删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });

            // 调用统一API删除商品
            await adminApi.deleteProduct(id);

            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            // 重新加载商品列表
            this.loadProducts();
          } catch (error) {
            wx.hideLoading();
            console.error('删除商品失败:', error);
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    })
  },

  /**
   * 扫描商品
   */
  scanProduct() {
    wx.navigateTo({
      url: '/pages/admin/product/scan/scan'
    });
  },

  /**
   * 导出商品数据为 CSV
   */
  async exportProducts() {
    wx.showLoading({ title: '导出中...' });
    try {
      const result = await productApi.exportProducts({ showLoading: false });
      const { fileID, total, fileName } = result;
      wx.hideLoading();

      // 获取临时下载链接
      const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: [fileID] });
      const tempUrl = tempUrlRes.fileList[0].tempFileURL;

      // 下载文件到本地
      const downloadRes = await wx.downloadFile({ url: tempUrl });
      if (downloadRes.statusCode !== 200) {
        throw new Error('下载失败');
      }

      // 保存到本地（优先持久化，失败则回退到临时路径）
      let userPath = downloadRes.tempFilePath;
      try {
        const saveRes = await wx.saveFile({ tempFilePath: downloadRes.tempFilePath });
        if (saveRes && saveRes.savedFilePath) {
          userPath = saveRes.savedFilePath;
        }
      } catch (saveErr) {
        console.warn('保存文件失败，使用临时文件继续分享:', saveErr);
      }

      // 提示用户分享文件
      wx.showModal({
        title: '导出成功',
        content: `已导出 ${total} 个商品。是否分享文件？`,
        confirmText: '分享',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.shareFileMessage({
              filePath: userPath,
              fileName: fileName,
              success: () => {
                wx.showToast({ title: '分享成功', icon: 'success' });
              },
              fail: (err) => {
                console.error('分享失败:', err);
                wx.showToast({ title: '分享失败', icon: 'none' });
              }
            });
          }
        }
      });
    } catch (err) {
      wx.hideLoading();
      console.error('导出商品失败:', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  /**
   * 导入商品数据（从 CSV 文件）
   */
  importProducts() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        const fileName = res.tempFiles[0].name;

        // 确认导入
        wx.showModal({
          title: '确认导入',
          content: `将从 "${fileName}" 导入商品数据，新商品将追加到现有列表。确认继续？`,
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.doImport(filePath);
            }
          }
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        console.error('选择文件失败:', err);
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  /**
   * 执行 CSV 导入
   */
  async doImport(filePath) {
    wx.showLoading({ title: '导入中...' });
    try {
      // 读取文件内容
      const fs = wx.getFileSystemManager();
      const csvContent = await new Promise((resolve, reject) => {
        fs.readFile({
          filePath,
          encoding: 'utf-8',
          success: (res) => resolve(res.data),
          fail: reject
        });
      });

      // 移除 BOM
      const cleanContent = csvContent.replace(/^\uFEFF/, '');

      // 调用云函数导入
      const result = await productApi.importProducts({
        csvContent: cleanContent,
        mode: 'append'
      }, {
        showLoading: false
      });

      wx.hideLoading();

      const { successCount, failCount, errors } = result;
      let message = `成功导入 ${successCount} 个商品`;
      if (failCount > 0) {
        message += `，${failCount} 个失败`;
        if (errors && errors.length > 0) {
          message += `\n失败详情：\n` + errors.slice(0, 5).map(e => `第${e.row}行: ${e.error}`).join('\n');
        }
      }

      wx.showModal({
        title: '导入完成',
        content: message,
        showCancel: false,
        success: () => {
          this.loadProducts(true);
        }
      });
    } catch (err) {
      wx.hideLoading();
      console.error('导入商品失败:', err);
      wx.showToast({ title: err.message || '导入失败', icon: 'none' });
    }
  }
})
