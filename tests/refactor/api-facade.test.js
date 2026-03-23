const test = require('node:test')
const assert = require('node:assert/strict')

test('utils/api facade matches services/api surface', () => {
  const utilsApi = require('../../miniprogram/utils/api.js')
  const servicesApi = require('../../miniprogram/services/api')

  assert.deepEqual(Object.keys(utilsApi).sort(), Object.keys(servicesApi).sort())
  assert.deepEqual(Object.keys(utilsApi.api).sort(), Object.keys(servicesApi.api).sort())
  assert.deepEqual(Object.keys(utilsApi.adminApi).sort(), Object.keys(servicesApi.adminApi).sort())
  assert.equal(typeof utilsApi.callCloudFunction, 'function')
})
