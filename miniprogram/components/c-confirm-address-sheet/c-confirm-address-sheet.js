function normalizeAddressList(addressList = [], selectedAddressId = '') {
  if (!Array.isArray(addressList)) {
    return [];
  }

  return addressList.map((item = {}, index) => ({
    ...item,
    _key: item.id || item._id || `address-${index}`,
    _selected: !!selectedAddressId && (item.id === selectedAddressId || item._id === selectedAddressId)
  }));
}

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    title: {
      type: String,
      value: '收货地址'
    },
    modalTitle: {
      type: String,
      value: '选择收货地址'
    },
    emptyText: {
      type: String,
      value: '点击选择收货地址'
    },
    address: {
      type: Object,
      value: null
    },
    addressList: {
      type: Array,
      value: []
    },
    visible: {
      type: Boolean,
      value: false
    },
    selectedAddressId: {
      type: String,
      value: ''
    },
    addressTagText: {
      type: String,
      value: '默认'
    }
  },
  data: {
    displayAddressList: []
  },
  observers: {
    'addressList, selectedAddressId': function(addressList, selectedAddressId) {
      this.setData({
        displayAddressList: normalizeAddressList(addressList, selectedAddressId)
      });
    }
  },
  lifetimes: {
    attached() {
      this.setData({
        displayAddressList: normalizeAddressList(this.data.addressList, this.data.selectedAddressId)
      });
    }
  },
  methods: {
    onOpen() {
      this.triggerEvent('open');
    },
    onClose() {
      this.triggerEvent('close');
    },
    onSelect(e) {
      const { index } = e.currentTarget.dataset;
      const address = this.data.displayAddressList[index];
      this.triggerEvent('select', { index, address });
    },
    onWechat() {
      this.triggerEvent('wechat');
    },
    onManage() {
      this.triggerEvent('manage');
    },
    preventTouchMove() {
      return false;
    },
    stopPropagation() {}
  }
});
