const EDITABLE_ORDER_V1_FIELDS = Object.freeze([
  'remark',
  'serviceTime'
]);

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestampForCompare(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

function normalizeExpectedUpdateTimeTransport(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeTimestampForCompare(value);
  return normalized || null;
}

function normalizeEditableOrderFormSnapshot(form = {}) {
  return {
    remark: normalizeString(form.remark),
    serviceTime: normalizeTimestampForCompare(form.serviceTime)
  };
}

function getEditableOrderFormChanges(initialForm = {}, currentForm = {}) {
  const initialSnapshot = normalizeEditableOrderFormSnapshot(initialForm);
  const currentSnapshot = normalizeEditableOrderFormSnapshot(currentForm);
  const changes = {};

  EDITABLE_ORDER_V1_FIELDS.forEach((field) => {
    if (initialSnapshot[field] !== currentSnapshot[field]) {
      changes[field] = currentSnapshot[field];
    }
  });

  return changes;
}

function normalizeEditableOrderItemsSnapshot(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const snapshotMap = new Map();

  items.forEach((item) => {
    const productId = normalizeString(item && (item.productId || item.id || item._id));
    if (!productId) {
      return;
    }

    const quantity = Number(item && item.quantity);
    const normalizedQuantity = Number.isFinite(quantity) ? Math.trunc(quantity) : 0;
    if (normalizedQuantity <= 0) {
      return;
    }

    const existingQuantity = snapshotMap.get(productId) || 0;
    snapshotMap.set(productId, existingQuantity + normalizedQuantity);
  });

  return Array.from(snapshotMap.entries())
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

function getEditableOrderItemsChanges(initialItems = [], currentItems = []) {
  const initialSnapshot = normalizeEditableOrderItemsSnapshot(initialItems);
  const currentSnapshot = normalizeEditableOrderItemsSnapshot(currentItems);

  if (JSON.stringify(initialSnapshot) === JSON.stringify(currentSnapshot)) {
    return undefined;
  }

  return currentSnapshot;
}

function isEditableOrderFormDirty(initialForm = {}, currentForm = {}) {
  return Object.keys(getEditableOrderFormChanges(initialForm, currentForm)).length > 0;
}

function isEditableOrderItemsDirty(initialItems = [], currentItems = []) {
  return !!getEditableOrderItemsChanges(initialItems, currentItems);
}

function canSubmitEditableOrderForm(initialForm = {}, currentForm = {}, initialItems = undefined, currentItems = undefined) {
  const formDirty = isEditableOrderFormDirty(initialForm, currentForm);
  const itemDirty = Array.isArray(initialItems) || Array.isArray(currentItems)
    ? isEditableOrderItemsDirty(initialItems || [], currentItems || [])
    : false;

  return formDirty || itemDirty;
}

function buildUpdateOrderContentPayload(input = {}) {
  const {
    orderId = '',
    expectedUpdateTime,
    initialForm = {},
    currentForm = {},
    initialItems = undefined,
    currentItems = undefined
  } = input;

  const changes = getEditableOrderFormChanges(initialForm, currentForm);
  const itemChanges = Array.isArray(initialItems) || Array.isArray(currentItems)
    ? getEditableOrderItemsChanges(initialItems || [], currentItems || [])
    : undefined;

  if (itemChanges) {
    changes.items = itemChanges;
  }

  return {
    orderId,
    expectedUpdateTime: normalizeExpectedUpdateTimeTransport(expectedUpdateTime),
    changes
  };
}

module.exports = {
  EDITABLE_ORDER_V1_FIELDS,
  normalizeCoordinate,
  normalizeTimestampForCompare,
  normalizeExpectedUpdateTimeTransport,
  normalizeEditableOrderFormSnapshot,
  getEditableOrderFormChanges,
  normalizeEditableOrderItemsSnapshot,
  getEditableOrderItemsChanges,
  isEditableOrderFormDirty,
  isEditableOrderItemsDirty,
  canSubmitEditableOrderForm,
  buildUpdateOrderContentPayload
};
