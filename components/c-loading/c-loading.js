/**
 * c-loading 加载状态组件
 * 统一的加载中状态展示
 */
Component({
  properties: {
    // 是否显示加载状态
    loading: {
      type: Boolean,
      value: false
    },
    // 加载提示文字
    text: {
      type: String,
      value: '加载中...'
    },
    // 大小：small / medium / large
    size: {
      type: String,
      value: 'medium'
    }
  },

  data: {
    sizeClass: 'size-medium'
  },

  observers: {
    'size': function(size) {
      const validSizes = ['small', 'medium', 'large'];
      const sizeClass = validSizes.includes(size) ? `size-${size}` : 'size-medium';
      this.setData({ sizeClass });
    }
  },

  lifetimes: {
    attached() {
      // 初始化尺寸类名
      const validSizes = ['small', 'medium', 'large'];
      const sizeClass = validSizes.includes(this.data.size) ? `size-${this.data.size}` : 'size-medium';
      this.setData({ sizeClass });
    }
  }
});
