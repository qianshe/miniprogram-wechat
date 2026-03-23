Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '选择商品'
    },
    categories: {
      type: Array,
      value: []
    },
    currentCategoryIndex: {
      type: Number,
      value: 0
    },
    products: {
      type: Array,
      value: []
    },
    productsLoading: {
      type: Boolean,
      value: false
    },
    hasMore: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onCategoryChange(e) {
      const { index } = e.currentTarget.dataset;
      const category = this.data.categories[index];
      this.triggerEvent('categorychange', {
        index,
        categoryId: category?.id || ''
      });
    },

    onProductSelect(e) {
      const { index } = e.currentTarget.dataset;
      const product = this.data.products[index];
      this.triggerEvent('productselect', {
        index,
        product
      });
    },

    onLoadMore() {
      if (!this.data.productsLoading && this.data.hasMore) {
        this.triggerEvent('loadmore');
      }
    },

    preventTouchMove() {
      return false;
    },

    stopPropagation() {}
  }
});
