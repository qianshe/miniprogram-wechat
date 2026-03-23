Component({
  options: {
    addGlobalClass: true
  },
  externalClasses: ['custom-class'],
  properties: {
    title: {
      type: String,
      value: '商品清单'
    },
    countText: {
      type: String,
      value: ''
    },
    metaText: {
      type: String,
      value: ''
    },
    items: {
      type: Array,
      value: []
    }
  },
  data: {
    displayItems: []
  },
  observers: {
    items(items) {
      const displayItems = Array.isArray(items)
        ? items.map((item = {}, index) => ({
            ...item,
            _key: item.key || item.productId || item.id || `item-${index}`
          }))
        : [];
      this.setData({ displayItems });
    }
  },
  lifetimes: {
    attached() {
      const items = this.data.items;
      const displayItems = Array.isArray(items)
        ? items.map((item = {}, index) => ({
            ...item,
            _key: item.key || item.productId || item.id || `item-${index}`
          }))
        : [];
      this.setData({ displayItems });
    }
  }
});