// Components/tabBar/tabBar.js
Component({
  data: {
    index: 0,
    list: [],
    ready: false
  },

  lifetimes: {
    created() {
      console.log('tabBar created');
    },

    attached() {
      console.log('tabBar attached');
      this.initTabBar();
    },

    ready() {
      console.log('tabBar ready');
      this.setData({ ready: true });
    },

    detached() {
      console.log('tabBar detached');
    }
  },

  pageLifetimes: {
    show() {
      console.log('tabBar page show');
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
              icon: "home"
            },
            {
              pagePath: "/pages/goods/category/category",
              text: "分类",
              icon: "app"
            },
            {
              pagePath: "/pages/user/user",
              text: "个人中心",
              icon: "user-circle"
            }
          ]
      };
      const app = getApp();
      
      this.setData({
        list: tabConfig.list,
        index: app.globalData.currentTabIndex || 0
      });
    },

    onChange(e) {
      const { value } = e.detail;
      const app = getApp();

      // 更新全局状态
      app.globalData.currentTabIndex = value;

      // 更新当前组件状态
      this.setData({
        index: value
      });

      // 跳转到对应页面
      const targetPage = this.data.list[value];
      if (targetPage) {
        wx.switchTab({
          url: targetPage.pagePath
        });
      }
    }
  }
})