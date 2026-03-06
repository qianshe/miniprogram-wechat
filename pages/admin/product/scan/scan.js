const { checkAdminAccess } = require('../../../../utils/adminGuard.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    scanResult: null,
    isScanning: false,
    isLoading: false,
    recognizedProduct: null,
    errorMessage: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!checkAdminAccess()) return
    // 如果有参数中有scanResultPath，表示从扫描页面返回
    if (options.scanResultPath) {
      this.setData({
        scanResult: options.scanResultPath
      });
      this.recognizeProduct(options.scanResultPath);
    } else {
      // 直接启动扫描
      this.startScan();
    }
  },

  /**
   * 启动扫描
   */
  startScan() {
    this.setData({
      isScanning: true,
      scanResult: null,
      recognizedProduct: null,
      errorMessage: ''
    });

    // 调用微信摄像头API
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        console.log('扫描成功:', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        this.setData({
          scanResult: tempFilePath,
          isScanning: false
        });
        
        // 识别商品
        this.recognizeProduct(tempFilePath);
      },
      fail: (err) => {
        console.error('扫描失败:', err);
        this.setData({
          isScanning: false,
          errorMessage: '扫描取消或失败'
        });
      }
    });
  },

  /**
   * 调用后端识别API
   */
  recognizeProduct(imagePath) {
    this.setData({
      isLoading: true,
      errorMessage: ''
    });

    // 模拟调用后端API进行识别
    // 实际项目中，这里应该使用wx.uploadFile上传图片到后端API，查询商品库
    setTimeout(() => {
      // 模拟识别结果 - 假设这是从库存中识别出的商品信息
      const mockProduct = {
        id: Math.floor(Math.random() * 1000) + 1,
        name: '健力宝运动饮料',
        price: 350, // 单位为分，3.5元
        originalPrice: 500, // 原价5元
        description: '健力宝运动饮料，补充能量',
        thumb: imagePath,
        stock: 86,
        sales: 324,
        status: 1,
        categoryId: 1,
        categoryName: '食品饮料',
        barcode: '6925281900335'
      };

      this.setData({
        recognizedProduct: mockProduct,
        isLoading: false
      });
    }, 2000);

    // 实际API调用代码应该类似：
    /*
    wx.uploadFile({
      url: 'https://your-api-endpoint/product/recognize',
      filePath: imagePath,
      name: 'image',
      success: (res) => {
        const result = JSON.parse(res.data);
        if (result.code === 200) {
          this.setData({
            recognizedProduct: result.data,
            isLoading: false
          });
        } else {
          this.setData({
            isLoading: false,
            errorMessage: result.message || '未能识别商品，请重试'
          });
        }
      },
      fail: (err) => {
        console.error('识别请求失败:', err);
        this.setData({
          isLoading: false,
          errorMessage: '网络请求失败，请检查网络连接'
        });
      }
    });
    */
  },

  /**
   * 重新扫描
   */
  reScan() {
    this.startScan();
  },

  /**
   * 查看商品详情
   */
  viewProductDetail() {
    const product = this.data.recognizedProduct;
    if (!product) return;

    wx.navigateTo({
      url: `/pages/goods/detail/detail?id=${product.id}`
    });
  },

  /**
   * 快速添加到购物车/订单
   */
  quickAddToOrder() {
    const product = this.data.recognizedProduct;
    if (!product) return;

    wx.showToast({
      title: '已添加到订单',
      icon: 'success'
    });
    
    // 实际应用中可能需要跳转到订单确认页或者添加到本地购物车
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/admin/order/create/create'
      });
    }, 1500);
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack();
  }
}); 