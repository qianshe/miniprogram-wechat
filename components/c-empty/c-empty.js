/**
 * c-empty 空状态组件
 * 统一的空数据状态展示
 */
Component({
  properties: {
    // 是否显示空状态
    show: {
      type: Boolean,
      value: false
    },
    // 空状态图片（可选）
    image: {
      type: String,
      value: ''
    },
    // 主标题
    title: {
      type: String,
      value: '暂无数据'
    },
    // 描述文字
    description: {
      type: String,
      value: ''
    },
    // 是否显示操作按钮
    showButton: {
      type: Boolean,
      value: false
    },
    // 按钮文字
    buttonText: {
      type: String,
      value: ''
    }
  },

  data: {
    defaultImage: 'https://tdesign.gtimg.com/mobile/demos/example3.png'
  },

  methods: {
    onButtonTap() {
      this.triggerEvent('action');
    }
  }
});
