const cloudConfig = require('../../../../config/cloud.config.js')
const { checkAdminAccess } = require('../../common/adminGuard.js')

Page({
  data: {
    imageTypes: [
      { 
        key: 'wechat-group-qrcode', 
        label: '用户交流群二维码', 
        desc: '用于反馈页面展示的微信群二维码，7天过期需定期更新',
        cloudPath: 'assets/qrcode/wechat-group.png',
        previewUrl: '',
        updateTime: '',
        loading: false
      },
      { 
        key: 'image-home', 
        label: '首页图片', 
        desc: '用于首页展示的图片',
        cloudPath: 'assets/images/image-home.png',
        previewUrl: '',
        updateTime: '',
        loading: false
      }
    ],
    selectedIndex: 0,
    pickerOptions: ['用户交流群二维码', '首页图片'],
    currentItem: null
  },

  onLoad() {
    if (!checkAdminAccess()) return;
    this.setData({ currentItem: this.data.imageTypes[0] });
    this.loadImagePreviews();
  },

  onShow() {
    this.loadImagePreviews();
  },

  onPickerChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      selectedIndex: index,
      currentItem: this.data.imageTypes[index]
    });
  },

  async loadImagePreviews() {
    const { imageTypes, selectedIndex } = this.data;
    const envId = cloudConfig.envId
    const fileList = imageTypes.map(item => `cloud://${envId}.636c-${envId}-1379027289/${item.cloudPath}`);
    
    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const updatedTypes = imageTypes.map((item, index) => {
        const fileInfo = res.fileList[index];
        return {
          ...item,
          previewUrl: fileInfo?.tempFileURL || '',
          updateTime: fileInfo?.tempFileURL ? this.formatTime(new Date()) : ''
        };
      });
      this.setData({ 
        imageTypes: updatedTypes,
        currentItem: updatedTypes[selectedIndex]
      });
    } catch (err) {
      console.log('获取图片预览失败', err);
    }
  },

  async onUpload() {
    const { selectedIndex } = this.data;
    const item = this.data.imageTypes[selectedIndex];
    
    try {
      this.setData({ 
        [`imageTypes[${selectedIndex}].loading`]: true,
        'currentItem.loading': true
      });

      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      wx.showLoading({ title: '上传中...' });

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: item.cloudPath,
        filePath: res.tempFilePaths[0]
      });

      const urlResult = await wx.cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });

      const newUrl = urlResult.fileList[0]?.tempFileURL || '';
      const newTime = this.formatTime(new Date());

      this.setData({
        [`imageTypes[${selectedIndex}].previewUrl`]: newUrl,
        [`imageTypes[${selectedIndex}].updateTime`]: newTime,
        'currentItem.previewUrl': newUrl,
        'currentItem.updateTime': newTime
      });

      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      if (err.errMsg?.includes('chooseImage:fail cancel')) return;
      wx.showToast({ title: '上传失败', icon: 'none' });
      console.error('上传失败', err);
    } finally {
      this.setData({ 
        [`imageTypes[${selectedIndex}].loading`]: false,
        'currentItem.loading': false
      });
    }
  },

  onPreview(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({ title: '暂无图片', icon: 'none' });
      return;
    }
    wx.previewImage({ urls: [url], current: url });
  },

  onImageLoad() {},

  onImageError() {},

  formatTime(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
});
