/**
 * 云开发环境配置（示例文件）
 * 
 * 使用说明：
 * 1. 复制此文件为 cloud.config.js
 * 2. 将 YOUR_CLOUDBASE_ENV_ID_HERE 替换为您的实际云开发环境ID
 * 3. 开发环境和生产环境可以使用相同或不同的云环境ID
 * 4. 如需区分环境，请根据小程序版本（develop/trial/release）选择
 * 5. 此配置文件被 app.js 引用，用于初始化 wx.cloud
 */

// 云开发环境ID配置
const cloudEnvConfig = {
  // 默认环境ID（当前使用的环境）
  envId: 'YOUR_CLOUDBASE_ENV_ID_HERE',
  
  // 多环境配置（可选）
  environments: {
    // 开发环境
    development: 'YOUR_CLOUDBASE_ENV_ID_HERE',
    // 生产环境（如有独立的生产环境，请修改此处）
    production: 'YOUR_CLOUDBASE_ENV_ID_HERE'
  }
}

/**
 * 云开发初始化选项
 * 可在此处配置更多 wx.cloud.init 参数
 */
const cloudOptions = {
  // 是否在将用户访问记录到用户管理中，在控制台中可见
  traceUser: true
}

/**
 * 获取当前环境ID
 * 根据小程序版本自动选择环境
 * @returns {string} 环境ID
 */
const getEnvId = () => {
  // 可以根据小程序版本动态选择环境
  // 取消下方注释可启用动态环境选择
  // try {
  //   const accountInfo = wx.getAccountInfoSync()
  //   const envVersion = accountInfo.miniProgram.envVersion
  //   if (envVersion === 'release') {
  //     return cloudEnvConfig.environments.production
  //   }
  //   return cloudEnvConfig.environments.development
  // } catch (error) {
  //   console.warn('获取小程序版本信息失败，使用默认环境:', error)
  // }
  return cloudEnvConfig.envId
}

module.exports = {
  // 环境ID - 被 app.js 中 wx.cloud.init 使用
  envId: cloudEnvConfig.envId,
  // 初始化选项 - 被 app.js 中 wx.cloud.init 使用
  options: cloudOptions,
  // 多环境配置
  environments: cloudEnvConfig.environments,
  // 动态获取环境ID的方法
  getEnvId
}