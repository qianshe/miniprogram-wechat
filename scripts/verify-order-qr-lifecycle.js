const assert = require('assert')
const {
  generateQrCodeKey,
  getQrExpiresAt,
  buildQrStoragePath,
  buildFallbackQrPayload,
  getQrLifecycleState
} = require('../cloudfunctions/orderManagement/_shared/qrLifecycle.js')

const key = generateQrCodeKey()
assert.ok(key.startsWith('qr_'), 'qrCodeKey should start with qr_')

const now = new Date('2026-03-18T00:00:00.000Z')
const expiresAt = getQrExpiresAt(now, 24)
assert.ok(expiresAt instanceof Date, 'expiresAt should be a Date')

assert.strictEqual(buildQrStoragePath({ orderNo: 'record_1', qrCodeKey: 'qr_xxx' }), 'qrcodes/qr_xxx.png')
assert.strictEqual(buildQrStoragePath({ orderNo: 'record_1', qrCodeKey: '' }), 'qrcodes/record_1.png')
assert.strictEqual(buildFallbackQrPayload('record_1'), 'orderNo=record_1')
assert.strictEqual(buildFallbackQrPayload(' record_2 '), 'orderNo=record_2')

const pending = getQrLifecycleState({ waitForBind: true, qrCodeKey: 'qr_x', qrCodeStatus: 'pending', qrCodeExpiresAt: new Date('2026-03-19T00:00:00.000Z') }, { now })
assert.strictEqual(pending.canBind, true)

const expired = getQrLifecycleState({ waitForBind: true, qrCodeKey: 'qr_x', qrCodeStatus: 'pending', qrCodeExpiresAt: new Date('2026-03-17T00:00:00.000Z') }, { now })
assert.strictEqual(expired.qrCodeStatus, 'expired')
assert.strictEqual(expired.canBind, false)

const used = getQrLifecycleState({ waitForBind: false, userId: 'user_1' }, { now })
assert.strictEqual(used.qrCodeStatus, 'used')
assert.strictEqual(used.canBind, false)

const legacy = getQrLifecycleState({ waitForBind: true }, { now })
assert.strictEqual(legacy.qrCodeStatus, 'pending')
assert.strictEqual(legacy.canBind, true)

const legacyUnboundWithoutExplicitFields = getQrLifecycleState({ waitForBind: false, userId: null }, { now })
assert.strictEqual(legacyUnboundWithoutExplicitFields.qrCodeStatus, 'pending')
assert.strictEqual(legacyUnboundWithoutExplicitFields.canBind, true)

console.log('verify-order-qr-lifecycle: PASS')