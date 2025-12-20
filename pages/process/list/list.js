const { api } = require('../../../utils/api.js');
const mockData = require('../../../config/mock.js');
const contactConfig = require('../../../config/contact.js');

Page({
  data: {
    steps: [],
    loading: true,
    systemType: 'white',
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
      const steps = await api.getProcessSteps({ 
        type: this.data.systemType === 'red' ? 1 : 0 
      });
      
      if (steps && steps.length > 0) {
        this.setData({ 
          steps,
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
    
    this.setData({ 
      steps: steps || [],
      loading: false 
    });
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