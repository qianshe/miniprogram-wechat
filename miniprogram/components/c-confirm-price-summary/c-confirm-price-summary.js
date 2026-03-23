Component({
  options: {
    addGlobalClass: true
  },
  externalClasses: ['custom-class'],
  properties: {
    title: {
      type: String,
      value: '价格明细'
    },
    rows: {
      type: Array,
      value: []
    }
  },
  data: {
    displayRows: []
  },
  observers: {
    rows(rows) {
      const displayRows = Array.isArray(rows)
        ? rows.map((row = {}, index) => ({
            ...row,
            _key: row.key || row.label || `row-${index}`
          }))
        : [];
      this.setData({ displayRows });
    }
  },
  lifetimes: {
    attached() {
      const rows = this.data.rows;
      const displayRows = Array.isArray(rows)
        ? rows.map((row = {}, index) => ({
            ...row,
            _key: row.key || row.label || `row-${index}`
          }))
        : [];
      this.setData({ displayRows });
    }
  }
});