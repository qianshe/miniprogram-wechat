const { adminApi } = require('../../../../utils/api.js');
const productApi = require('../../../../api/product.js');
const { checkAdminAccess } = require('../../common/adminGuard.js');
const cloudConfig = require('../../../../config/cloud.config.js');

function pickImage(source = {}) {
  if (!source || typeof source !== 'object') return '';
  return source.coverImage || source.productImage || source.imageUrl || source.image || source.thumb || (Array.isArray(source.images) ? source.images[0] : '') || '';
}

function parseCloudFile(fileId = '') {
  const normalized = String(fileId || '').trim();
  const match = normalized.match(/^cloud:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, envAndBucket, cloudPath] = match;
  const bucket = envAndBucket.split('.').slice(1).join('.');
  if (!bucket || !cloudPath) return null;
  return {
    fileId: normalized,
    bucket,
    cloudPath,
    cdnUrl: `https://${bucket}.tcb.qcloud.la/${cloudPath}`
  };
}

function buildQrCodeFileId(orderNo) {
  return buildQrCodeFileIdFromKey('', orderNo);
}

function buildQrCodeFileIdFromKey(qrCodeKey, orderNo) {
  const normalizedKey = String(qrCodeKey || '').trim();
  const normalizedOrderNo = String(orderNo || '').trim();
  const fileKey = normalizedKey || normalizedOrderNo;
  if (!fileKey) return '';
  const bucket = `636c-${cloudConfig.envId}-1379027289`;
  return `cloud://${cloudConfig.envId}.${bucket}/qrcodes/${fileKey}.png`;
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    orderNo: '',
    qrCodeFileId: '',
    qrCodeUrl: '',
    qrCodeUnavailable: false,
    orderInfo: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!checkAdminAccess()) return
    if (options.orderNo) {
      const passedFileId = options.qrCodeUrl ? decodeURIComponent(options.qrCodeUrl) : '';
      this.setData({
        orderNo: options.orderNo, // 订单号
        qrCodeFileId: passedFileId
      });

      if (passedFileId) {
        this.resolveQrCodeUrl(passedFileId);
      }

      // 获取订单详情
      this.loadOrderDetail(options.orderNo);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  async resolveQrCodeUrl(fileId) {
    if (!fileId) {
      this.setData({ qrCodeUrl: '', qrCodeUnavailable: true });
      return '';
    }

    if (!/^cloud:\/\//.test(fileId)) {
      this.setData({ qrCodeUrl: fileId, qrCodeUnavailable: false });
      return fileId;
    }

    const parsed = parseCloudFile(fileId);

    try {
      if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
        const fallbackUrl = parsed ? parsed.cdnUrl : '';
        this.setData({ qrCodeUrl: fallbackUrl, qrCodeUnavailable: !fallbackUrl });
        return fallbackUrl;
      }

      const res = await wx.cloud.getTempFileURL({
        fileList: [fileId]
      });
      const tempFileURL = res?.fileList?.[0]?.tempFileURL || '';
      const finalUrl = tempFileURL || (parsed ? parsed.cdnUrl : '');
      this.setData({ qrCodeUrl: finalUrl, qrCodeUnavailable: !finalUrl });
      return finalUrl;
    } catch (err) {
      console.error('转换二维码临时链接失败:', err);
      const fallbackUrl = parsed ? parsed.cdnUrl : '';
      this.setData({ qrCodeUrl: fallbackUrl, qrCodeUnavailable: !fallbackUrl });
      return fallbackUrl;
    }
  },

  async resolveItemImageUrls(items = []) {
    const cloudIds = [];
    const directUrlMap = new Map();

    items.forEach((item) => {
      const image = String(item.productImage || '').trim();
      if (!image) return;
      if (/^cloud:\/\//.test(image)) {
        cloudIds.push(image);
      } else {
        directUrlMap.set(image, image);
      }
    });

    const resolvedMap = new Map(directUrlMap);
    const uniqueCloudIds = [...new Set(cloudIds)];

    if (!uniqueCloudIds.length) {
      return items.map(item => ({ ...item, displayImage: item.productImage || '' }));
    }

    try {
      if (wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
        const res = await wx.cloud.getTempFileURL({ fileList: uniqueCloudIds });
        (res?.fileList || []).forEach((entry) => {
          const parsed = parseCloudFile(entry.fileID);
          resolvedMap.set(entry.fileID, entry.tempFileURL || (parsed ? parsed.cdnUrl : ''));
        });
      }
    } catch (err) {
      console.error('转换商品图片临时链接失败:', err);
    }

    uniqueCloudIds.forEach((fileId) => {
      if (!resolvedMap.has(fileId)) {
        const parsed = parseCloudFile(fileId);
        resolvedMap.set(fileId, parsed ? parsed.cdnUrl : '');
      }
    });

    return items.map(item => ({
      ...item,
      displayImage: resolvedMap.get(item.productImage) || ''
    }));
  },

  async hydrateMissingItemImages(items = []) {
    const hydratedItems = await Promise.all((items || []).map(async (item) => {
      if (item.productImage || !item.productId) {
        return item;
      }

      try {
        const product = await productApi.adminGetDetail({ id: item.productId }, { showLoading: false });
        return {
          ...item,
          productImage: pickImage(product)
        };
      } catch (err) {
        console.error('补充商品图片失败:', item.productId, err);
        return item;
      }
    }));

    return this.resolveItemImageUrls(hydratedItems);
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail(orderNo) {
    wx.showLoading({
      title: '加载中...'
    });

    try {
      // 调用统一API获取订单详情
      const data = await adminApi.getOrderDetail(orderNo);

      wx.hideLoading();

      const items = Array.isArray(data.items) ? data.items : [];
      const hydratedItems = await this.hydrateMissingItemImages(items);

      this.setData({
        orderInfo: {
          ...data,
          totalAmount: data.totalAmount.toFixed(2), // 云函数已转换为元
          items: hydratedItems.map((item) => ({
            ...item,
            productPrice: Number(item.price || 0).toFixed(2),
            subtotal: Number(item.subtotal || 0).toFixed(2)
          }))
        }
      });

      const rawQrCodeUrl = data.qrCodeUrl
        ? (buildQrCodeFileIdFromKey(data.qrCodeKey, orderNo) || data.qrCodeUrl)
        : (this.data.qrCodeFileId || '');
      if (rawQrCodeUrl) {
        this.setData({ qrCodeFileId: rawQrCodeUrl });
        await this.resolveQrCodeUrl(rawQrCodeUrl);
      } else {
        this.setData({ qrCodeFileId: '', qrCodeUrl: '', qrCodeUnavailable: true });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);
      wx.showToast({
        title: err.message || err.result?.message || '获取服务记录详情失败',
        icon: 'none'
      });
    }
  },

  /**
   * 保存二维码到相册
   */
  saveQrCode() {
    if (!this.data.qrCodeUrl) {
      wx.showToast({
        title: '二维码不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '保存中...'
    });
    
    // 保存图片
    wx.downloadFile({
      url: this.data.qrCodeUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
              console.error('保存图片失败:', err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
        console.error('下载二维码失败:', err);
      }
    });
  },

  /**
   * 分享订单
   */
  shareOrder() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 返回列表
   */
  backToList() {
    wx.redirectTo({
      url: '/pages/admin/order/list/list'
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: `记录编号:${this.data.orderNo}`,
      path: `/pages/scan-result/scan-result?orderNo=${this.data.orderNo}`,
      imageUrl: this.data.qrCodeUrl
    };
  },


}); 
