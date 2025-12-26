/**
 * c-quantity-stepper 数量选择器组件
 * 统一的数量加减操作器
 */
Component({
  properties: {
    // 当前数量
    value: {
      type: Number,
      value: 1
    },
    // 最小值
    min: {
      type: Number,
      value: 1
    },
    // 最大值
    max: {
      type: Number,
      value: 99
    },
    // 步长
    step: {
      type: Number,
      value: 1
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    minusDisabled: false,
    plusDisabled: false
  },

  observers: {
    'value, min, max, disabled': function(value, min, max, disabled) {
      this.setData({
        minusDisabled: disabled || value <= min,
        plusDisabled: disabled || value >= max
      });
    }
  },

  lifetimes: {
    attached() {
      this.setData({
        minusDisabled: this.data.disabled || this.data.value <= this.data.min,
        plusDisabled: this.data.disabled || this.data.value >= this.data.max
      });
    }
  },

  methods: {
    onMinus() {
      if (this.data.disabled || this.data.value <= this.data.min) return;
      const newValue = Math.max(this.data.min, this.data.value - this.data.step);
      this.triggerEvent('change', { value: newValue });
    },

    onPlus() {
      if (this.data.disabled || this.data.value >= this.data.max) return;
      const newValue = Math.min(this.data.max, this.data.value + this.data.step);
      this.triggerEvent('change', { value: newValue });
    }
  }
});
