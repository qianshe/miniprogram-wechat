function generateQrCodeKey() {
  return `qr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getQrExpiresAt(now, ttlHours) {
  const hours = Number(ttlHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function buildQrStoragePath({ orderNo, qrCodeKey }) {
  return `qrcodes/${qrCodeKey || orderNo}.png`;
}

function buildFallbackQrPayload(orderNo) {
  const normalizedOrderNo = typeof orderNo === 'string' ? orderNo.trim() : '';
  return normalizedOrderNo ? `orderNo=${encodeURIComponent(normalizedOrderNo)}` : '';
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasLegacyBoundUser(order) {
  if (!order || typeof order !== 'object') {
    return false;
  }

  if (typeof order.userId === 'string' && order.userId.trim()) {
    return true;
  }

  if (order.userId && typeof order.userId !== 'string') {
    return true;
  }

  if (typeof order.qrCodeUsedByOpenid === 'string' && order.qrCodeUsedByOpenid.trim()) {
    return true;
  }

  return false;
}

function getQrLifecycleState(order, { now = new Date() } = {}) {
  const waitForBind = order && order.waitForBind !== false;
  const explicitStatus = order && typeof order.qrCodeStatus === 'string' ? order.qrCodeStatus : '';
  const expiresAt = normalizeDate(order && order.qrCodeExpiresAt);
  const usedAt = normalizeDate(order && order.qrCodeUsedAt);
  const hasExplicitFields = !!(order && (order.qrCodeKey || explicitStatus || expiresAt || usedAt));
  const legacyBoundUser = hasLegacyBoundUser(order);

  if (!hasExplicitFields) {
    if (waitForBind || !legacyBoundUser) {
      return {
        hasExplicitFields: false,
        qrCodeStatus: 'pending',
        canBind: true,
        isBound: false,
        bindBlockedReason: ''
      };
    }

    return {
      hasExplicitFields: false,
      qrCodeStatus: 'used',
      canBind: false,
      isBound: true,
      bindBlockedReason: '二维码已被使用'
    };
  }

  if (!waitForBind || explicitStatus === 'used' || usedAt) {
    return {
      hasExplicitFields: true,
      qrCodeStatus: 'used',
      canBind: false,
      isBound: true,
      bindBlockedReason: '二维码已被使用'
    };
  }

  if (explicitStatus === 'expired' || (expiresAt && now > expiresAt)) {
    return {
      hasExplicitFields: true,
      qrCodeStatus: 'expired',
      canBind: false,
      isBound: false,
      bindBlockedReason: '二维码已过期'
    };
  }

  return {
    hasExplicitFields: true,
    qrCodeStatus: 'pending',
    canBind: true,
    isBound: false,
    bindBlockedReason: ''
  };
}

module.exports = {
  generateQrCodeKey,
  getQrExpiresAt,
  buildQrStoragePath,
  buildFallbackQrPayload,
  getQrLifecycleState
};