/**
 * c-price 价格展示组件
 * 统一的价格展示（支持原价/折扣价/单位）
 */
Component({
  properties: {
    // 当前价格（元）
    price: {
      type: Number,
      value: 0
    },
    // 原价（元，有值且大于price则显示划线）
    originalPrice: {
      type: Number,
      value: 0
    },
    // 大小：small / medium / large
    size: {
      type: String,
      value: 'medium'
    },
    // 价格颜色
    color: {
      type: String,
      value: '#d24b41'
    },
    // 单位（如 /件）
    unit: {
      type: String,
      value: ''
    },
    // 小数位数
    decimals: {
      type: Number,
      value: 2
    }
  },

  data: {
    sizeClass: 'size-medium',
    displayPrice: '0.00',
    displayOriginalPrice: '0.00',
    showOriginal: false
  },

  observers: {
    'size': function(size) {
      const validSizes = ['small', 'medium', 'large'];
      const sizeClass = validSizes.includes(size) ? `size-${size}` : 'size-medium';
      this.setData({ sizeClass });
    },
    'price, originalPrice, decimals': function(price, originalPrice, decimals) {
      const displayPrice = Number(price || 0).toFixed(decimals);
      const displayOriginalPrice = Number(originalPrice || 0).toFixed(decimals);
      const showOriginal = originalPrice > 0 && originalPrice > price;
      this.setData({ displayPrice, displayOriginalPrice, showOriginal });
    }
  },

  lifetimes: {
    attached() {
      // 初始化
      const validSizes = ['small', 'medium', 'large'];
      const sizeClass = validSizes.includes(this.data.size) ? `size-${this.data.size}` : 'size-medium';
      const displayPrice = Number(this.data.price || 0).toFixed(this.data.decimals);
      const displayOriginalPrice = Number(this.data.originalPrice || 0).toFixed(this.data.decimals);
      const showOriginal = this.data.originalPrice > 0 && this.data.originalPrice > this.data.price;
      this.setData({ sizeClass, displayPrice, displayOriginalPrice, showOriginal });
    }
  }
});
