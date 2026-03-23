const { api } = require('./public')
const { adminApi } = require('./admin')
const { priceToYuan } = require('./helpers')
const { call } = require('../cloudFunction/index.js')

module.exports = {
  api,
  adminApi,
  priceToYuan,
  callCloudFunction: call
}