const { api } = require('../../../utils/api.js');
const mockData = require('../../../config/mock.js');
const contactConfig = require('../../../config/contact.js');

Page({
  data: {
    steps: [],
    loading: true,
    systemType: 'white',
    isFallbackData: false,
    servicePhone: contactConfig.servicePhone
  },

  onLoad(options) {
    const app = getApp();
    const systemType = app.globalData.systemType || 'white';
    
    this.setData({ systemType });
    this.loadProcessSteps();
  },

  async loadProcessSteps() {
    this.setData({ loading: true });
    
    try {
      // 从云函数获取流程步骤
      const response = await api.getProcessSteps({ 
        type: this.data.systemType === 'red' ? 1 : 0 
      });
      const steps = Array.isArray(response) ? response : response?.records;
      
      if (steps && steps.length > 0) {
        const normalizedSteps = steps
          .map(step => this.normalizeStep(step))
          .filter(step => step.status !== 0);

        this.setData({ 
          steps: normalizedSteps,
          isFallbackData: false,
          loading: false 
        });
      } else {
        // 降级到mock数据
        this.loadMockSteps();
      }
    } catch (err) {
      console.error('获取流程步骤失败:', err);
      // 降级到mock数据
      this.loadMockSteps();
    }
  },

  loadMockSteps() {
    // 使用mock数据
    const steps = this.data.systemType === 'red' 
      ? mockData.redSteps 
      : mockData.whiteSteps;

    const normalizedSteps = (steps || []).map(step => this.normalizeStep(step));
    
    this.setData({ 
      steps: normalizedSteps,
      isFallbackData: true,
      loading: false 
    });
  },

  normalizeStep(step = {}) {
    return {
      ...step,
      content: step.content || '',
      type: step.type !== undefined ? step.type : (this.data.systemType === 'red' ? 1 : 0),
      order: step.order || 0,
      imageUrl: step.imageUrl || '',
      tips: Array.isArray(step.tips) ? step.tips : [],
      productList: Array.isArray(step.productList) ? step.productList : [],
      status: step.status !== undefined ? step.status : 1
    };
  },

  onStepClick(e) {
    const { step } = e.currentTarget.dataset;
    const stepId = step._id || step.id;
    
    wx.navigateTo({
      url: `/pages/process/detail/detail?stepId=${stepId}&systemType=${this.data.systemType}`,
      fail: (err) => {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onCallService() {
    wx.makePhoneCall({
      phoneNumber: this.data.servicePhone,
      fail: () => {
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  }
});
