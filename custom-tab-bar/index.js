// Components/tabBar/tabBar.js
Component({
  data: {
    index: 0,
    list: [],
    ready: false,
    show: true  // 控制 tabbar 显示/隐藏，非 tabBar 页面可设置为 false
  },

  lifetimes: {
    created() {
      this.syncTimer = null;
    },

    attached() {
      this.initTabBar();
    },

    ready() {
      this.setData({ ready: true }, () => {
        const app = getApp();
        const systemType = app.globalData.systemType || 'white';
        this.scheduleTabSync(systemType, 0);
      });
    },

    detached() {
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
        this.syncTimer = null;
      }
    }
  },

  pageLifetimes: {
    show() {
      const app = getApp();
      const systemType = app.globalData.systemType || 'white';
      this.scheduleTabSync(systemType, this.data.ready ? 20 : 80, 0);
    }
  },

  methods: {
    scheduleTabSync(systemType, delay = 0, retryCount = 0) {
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }

      this.syncTimer = setTimeout(() => {
        this.updateTabList(systemType, retryCount);
        this.syncTimer = null;
      }, delay);
    },

    normalizePath(path) {
      if (!path || typeof path !== 'string') return '';
      return path.startsWith('/') ? path : `/${path}`;
    },

    getCurrentPagePath() {
      const pages = getCurrentPages();
      const currentPage = pages && pages.length > 0 ? pages[pages.length - 1] : null;
      return currentPage && currentPage.route ? this.normalizePath(currentPage.route) : '';
    },

    getIndexByPath(list, pagePath) {
      if (!Array.isArray(list) || !pagePath) return -1;
      const normalizedPath = this.normalizePath(pagePath);
      return list.findIndex(item => this.normalizePath(item.pagePath) === normalizedPath);
    },

    initTabBar() {
      const app = getApp();
      const systemType = app.globalData.systemType || 'white';
      this.scheduleTabSync(systemType, 0);
    },

    updateTabList(systemType, retryCount = 0) {
      if (!systemType) {
        console.warn('systemType is undefined, using default "white"');
        systemType = 'white';
      }

      const tabConfig = {
        list: [
          {
            pagePath: "/pages/index/index",
            text: "首页",
            emoji: "🏠"
          },
          {
            pagePath: "/pages/goods/category/category",
            text: "服务/产品分类",
            emoji: "📦"
          },
          {
            pagePath: "/pages/cart/cart",
            text: "治丧清单",
            emoji: "📋"
          },
          {
            pagePath: "/pages/user/user",
            text: "我的",
            emoji: "👤"
          }
        ]
      };
      const app = getApp();

      const list = tabConfig.list;
      const pageIndex = this.getIndexByPath(tabConfig.list, this.getCurrentPagePath());

      if (pageIndex < 0) {
        const currentIndex = Number(this.data.index);
        const safeCurrentIndex = Number.isInteger(currentIndex)
          && currentIndex >= 0
          && currentIndex < list.length
          ? currentIndex
          : 0;

        this.setData({
          list,
          index: safeCurrentIndex
        });

        if (retryCount < 3) {
          this.scheduleTabSync(systemType, 80, retryCount + 1);
        }
        return;
      }

      const resolvedIndex = pageIndex;

      app.globalData.currentTabIndex = resolvedIndex;

      this.setData({
        list,
        index: resolvedIndex
      });
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      const app = getApp();
      const targetIndex = Number(index);
      const safeIndex = Number.isInteger(targetIndex) && targetIndex >= 0 ? targetIndex : 0;

      // 更新全局状态
      app.globalData.currentTabIndex = safeIndex;

      // 更新当前组件状态
      this.setData({
        index: safeIndex
      });

      // 跳转到对应页面
      wx.switchTab({
        url: path
      });
    }
  }
})
