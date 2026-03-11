Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true
  },
  externalClasses: ['custom-class'],
  properties: {
    title: {
      type: String,
      value: ''
    },
    hint: {
      type: String,
      value: '(选填)'
    },
    compact: {
      type: Boolean,
      value: false
    }
  }
});
