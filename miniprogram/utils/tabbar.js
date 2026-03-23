/**
 * TabBar 工具函数
 * 统一管理 TabBar 的更新逻辑
 */

/**
 * 更新 TabBar 列表
 * @param {Object} pageInstance - 页面实例 (this)
 * @param {string} systemType - 系统类型 ('white' | 'red')
 * @param {number} delay - 延迟时间（毫秒），默认0ms
 * @param {number} retries - 重试次数，默认2次
 * @param {number} retryInterval - 重试间隔（毫秒），默认80ms
 */
const updateTabBar = (pageInstance, systemType, delay = 0, retries = 2, retryInterval = 80) => {
  if (!pageInstance) {
    console.warn('[TabBar] 页面实例不存在');
    return;
  }

  let attempts = 0;

  const sync = () => {
    if (typeof pageInstance.getTabBar !== 'function') {
      return;
    }

    const tabBar = pageInstance.getTabBar();
    if (tabBar && typeof tabBar.updateTabList === 'function') {
      tabBar.updateTabList(systemType);
      return;
    }

    if (attempts < retries) {
      attempts += 1;
      setTimeout(sync, retryInterval);
    }
  };

  setTimeout(sync, delay);
};

/**
 * 获取当前系统类型并更新 TabBar
 * @param {Object} pageInstance - 页面实例 (this)
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {string} 当前系统类型
 */
const syncTabBarWithSystem = (pageInstance, delay = 0) => {
  const app = getApp();
  const systemType = app.globalData.systemType || 'white';
  
  updateTabBar(pageInstance, systemType, delay);
  
  return systemType;
};

/**
 * 页面 onShow 时的通用处理
 * 获取系统类型、更新主题色、更新 TabBar
 * @param {Object} pageInstance - 页面实例 (this)
 * @param {Object} options - 配置选项
 * @param {boolean} options.updateTheme - 是否更新主题色，默认true
 * @param {number} options.delay - TabBar更新延迟，默认0ms
 * @returns {Object} { systemType, themeColor }
 */
const handlePageShow = (pageInstance, options = {}) => {
  const { updateTheme = true, delay = 0 } = options;
  
  const app = getApp();
  const systemType = app.globalData.systemType || 'white';
  const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
  
  // 更新页面数据
  if (pageInstance && typeof pageInstance.setData === 'function') {
    const updateData = { systemType };
    if (updateTheme) {
      updateData.themeColor = themeColor;
    }
    pageInstance.setData(updateData);
  }
  
  // 更新 TabBar
  updateTabBar(pageInstance, systemType, delay);
  
  return { systemType, themeColor };
};

/**
 * 页面 onLoad 时的通用处理
 * @param {Object} pageInstance - 页面实例 (this)
 * @param {Object} options - 配置选项
 * @returns {Object} { systemType, themeColor }
 */
const handlePageLoad = (pageInstance, options = {}) => {
  const app = getApp();
  const systemType = app.globalData.systemType || 'white';
  const themeColor = systemType === 'red' ? '#d32f2f' : '#333333';
  
  // 更新页面数据
  if (pageInstance && typeof pageInstance.setData === 'function') {
    pageInstance.setData({
      systemType,
      themeColor
    });
  }
  
  return { systemType, themeColor };
};

module.exports = {
  updateTabBar,
  syncTabBarWithSystem,
  handlePageShow,
  handlePageLoad
};
