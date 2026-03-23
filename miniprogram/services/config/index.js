const apiConfig = require('../../config/api.config.js')
const cloudConfig = require('../../config/cloud.config.js')

module.exports = {
  apiConfig,
  cloudConfig,
  envId: cloudConfig.envId,
  cloudFunction: apiConfig.cloudFunction,
  collections: apiConfig.collections,
  storage: apiConfig.storage,
  timeouts: apiConfig.timeouts || {},
  log: apiConfig.log || {},
  raw: apiConfig
}
