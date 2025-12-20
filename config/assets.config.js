/**
 * 静态资源配置
 * 
 * 集中管理云存储资源URL，便于环境切换和维护
 */

const cloudConfig = require('./cloud.config.js')

const cloudStorageBase = `cloud://${cloudConfig.envId}.636c-${cloudConfig.envId}-1379027289`

module.exports = {
  // 首页banner图
  homePageBanner: `${cloudStorageBase}/assets/images/home.jpg`,
  // 首页背景图
  homeImage: `${cloudStorageBase}/assets/images/image-home.png`
}
