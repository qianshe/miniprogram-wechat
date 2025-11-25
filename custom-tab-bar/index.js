// Components/tabBar/tabBar.js
Component({
  data: {
    index: 0,
    list: [],
    ready: false
  },

  lifetimes: {
    created() {
    },

    attached() {
      this.initTabBar();
    },

    ready() {
      this.setData({ ready: true });
    },

    detached() {
    }
  },

  pageLifetimes: {
    show() {
      if (this.data.ready) {
        const app = getApp();
        const systemType = app.globalData.systemType || 'white';
        this.updateTabList(systemType);
      }
    }
  },

  methods: {
    initTabBar() {
      const app = getApp();
      const systemType = app.globalData.systemType || 'white';
      this.updateTabList(systemType);
    },

    updateTabList(systemType) {
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

      this.setData({
        list: tabConfig.list,
        index: app.globalData.currentTabIndex || 0
      });
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      const app = getApp();

      // 更新全局状态
      app.globalData.currentTabIndex = index;

      // 更新当前组件状态
      this.setData({
        index: index
      });

      // 跳转到对应页面
      wx.switchTab({
        url: path
      });
    }
  }
})