/**
 * @fileoverview Canonical machine-readable fixture source for order workflow verification.
 *
 * This module is the SINGLE SOURCE OF TRUTH for all Phase 0 verification scripts.
 * The appendices in the plan file (.sisyphus/plans/order-workflow-staged-refactor-plan.md)
 * are the human-readable semantic mirror of this file.
 *
 * MAINTENANCE RULE:
 * - When fixture semantics change, update BOTH this file AND the plan appendices.
 * - Never parse the plan markdown directly; verification scripts consume this module.
 *
 * Canonical fixture IDs (DO NOT invent aliases):
 * - unclaimed-admin-created
 * - claimed-unconfirmed
 * - confirmed-ready-for-service
 * - processing
 * - service-done-unpaid
 * - completed
 * - cancelled
 *
 * Phase-specific variants use PROPERTIES, not alias fixture IDs:
 * - e.g., processing with { appendAllowed: true }, NOT "processing-with-append-allowed"
 */

'use strict';

// ============================================================================
// STATE VALUE CONSTANTS (aligned with config/constants.js)
// ============================================================================

/**
 * Order flow status values (orderStatus field)
 * @see config/constants.js ORDER_FLOW_STATUS
 */
const ORDER_FLOW_STATUS = {
  CREATED: 0,      // 已创建/待服务
  PROCESSING: 1,   // 处理中/服务中
  SERVICE_DONE: 2, // 服务完成
  COMPLETED: 3,    // 订单完成
  CANCELLED: 4     // 已取消
};

/**
 * Payment status values (paymentStatus field)
 * @see config/constants.js PAYMENT_STATUS
 */
const PAYMENT_STATUS = {
  UNPAID: 0, // 未支付
  PAID: 1    // 已支付
};

/**
 * QR lifecycle status values (qrCodeStatus field)
 * @see cloudfunctions/orderManagement/_shared/qrLifecycle.js
 */
const QR_CODE_STATUS = {
  PENDING: 'pending',
  EXPIRED: 'expired',
  USED: 'used'
};

// ============================================================================
// CANONICAL FIXTURE DEFINITIONS
// ============================================================================

/**
 * Base fixture shape for all fixtures.
 * @typedef {Object} OrderWorkflowFixture
 * @property {string} fixtureId - Canonical fixture ID (must match plan exactly)
 * @property {string} purpose - Human-readable purpose description
 * @property {Object} fields - Field values for this fixture
 * @property {Object} [baselineExpectation] - Current-state expectation (Phase 0 baseline)
 * @property {Object} [targetExpectation] - Target-state expectation (post-refactor)
 * @property {Object} [phaseMetadata] - Phase-specific properties (not alias IDs)
 */

/**
 * Canonical fixtures aligned with Appendices A and B of the plan.
 *
 * Each fixture includes:
 * - fields: the minimal field shape representing that fixture's state
 * - baselineExpectation: how current repo semantics treat this fixture
 * - targetExpectation: how post-refactor semantics should treat this fixture
 * - phaseMetadata: phase-specific properties (e.g., cancelAllowed, appendAllowed)
 */
const FIXTURES = {
  /**
   * Admin-created record before any QR claim.
   * Ownership: admin-owned userOpenid, waitForBind=true
   * QR lifecycle: pending, claimable
   * Workflow: initial state, unpaid
   */
  'unclaimed-admin-created': {
    fixtureId: 'unclaimed-admin-created',
    purpose: 'Admin-created record before any QR claim',
    fields: {
      // Ownership markers
      waitForBind: true,
      userOpenid: 'admin_openid_placeholder',
      userId: null,

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.PENDING,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: null,

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.CREATED,
      status: 0, // legacy compatibility

      // Payment markers
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: null,
      serviceCompletedAt: null,
      completeTime: null
    },
    baselineExpectation: {
      isClaimable: true,
      ownershipTransferred: false,
      firstClassConfirmation: false,
      canStartService: false,
      canConfirmPayment: false
    },
    targetExpectation: {
      isClaimable: true,
      ownershipTransferred: false,
      firstClassConfirmation: false,
      canStartService: false,
      canConfirmPayment: false
    },
    phaseMetadata: {
      cancelAllowed: true,
      cancelWindow: 'before-service-start'
    }
  },

  /**
   * Record after QR claim but before user confirmation.
   * Ownership: transferred to claimed user, waitForBind=false
   * QR lifecycle: used
   * Workflow: pre-confirmation, payment unchanged
   *
   * CRITICAL: Claim transfers ownership only; claim does NOT imply confirmation.
   */
  'claimed-unconfirmed': {
    fixtureId: 'claimed-unconfirmed',
    purpose: 'Record after QR claim but before user confirmation',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'claimed_user_openid',
      userId: 'claimed_user_id',

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.USED,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: new Date('2026-03-18T10:00:00.000Z'),

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.CREATED,
      status: 0, // legacy compatibility (CREATED + UNPAID maps to 0)

      // Payment markers
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: null,
      serviceCompletedAt: null,
      completeTime: null,

      // Confirmable content
      address: '用户地址待确认',
      contactName: '联系人待确认',
      contactPhone: '',
      serviceTime: null,
      remark: ''
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      // In baseline, confirmation is NOT a first-class state
      firstClassConfirmation: false,
      // Baseline may conflate claim with readiness
      canStartService: 'compatibility-dependent',
      canConfirmPayment: false
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      // In target, this is distinct from confirmed-ready-for-service
      firstClassConfirmation: false,
      // Start-service gated by confirmation, not payment
      canStartService: false,
      canConfirmPayment: false,
      // Communication window is open
      communicationWindowOpen: true
    },
    phaseMetadata: {
      // Phase 2 cancellation matrix: allowed before service starts
      cancelAllowed: true,
      cancelWindow: 'before-service-start'
    }
  },

  /**
   * User has submitted confirmation.
   * Ownership: same as claimed state
   * QR lifecycle: used
   * Workflow: explicit confirmation milestone active
   * Payment: still independent
   *
   * In BASELINE: this fixture collapses back onto pre-service semantics
   * (confirmation milestone not yet first-class).
   * In TARGET: this is a distinct state ready for service start.
   */
  'confirmed-ready-for-service': {
    fixtureId: 'confirmed-ready-for-service',
    purpose: 'User has submitted confirmation, ready for service start',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'claimed_user_openid',
      userId: 'claimed_user_id',

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.USED,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: new Date('2026-03-18T10:00:00.000Z'),

      // Workflow markers
      // NOTE: In target, this will use a new explicit confirmation value
      // For now, still CREATED but with confirmed content
      orderStatus: ORDER_FLOW_STATUS.CREATED,
      status: 0, // legacy compatibility

      // Payment markers (still independent)
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: null,
      serviceCompletedAt: null,
      completeTime: null,

      // Confirmed content
      address: '已确认的详细地址',
      contactName: '已确认联系人',
      contactPhone: '13800138000',
      serviceTime: '2026-03-20 09:00',
      remark: '用户已确认备注',
      contentConfirmedAt: new Date('2026-03-18T11:00:00.000Z')
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      // BASELINE: confirmation is NOT first-class
      firstClassConfirmation: false,
      // Baseline verifier should report this fixture as not yet first-class
      isDistinctFromClaimed: false,
      canStartService: 'compatibility-dependent',
      canConfirmPayment: false
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      // TARGET: confirmation IS first-class
      firstClassConfirmation: true,
      isDistinctFromClaimed: true,
      // Service start is gated by confirmation, not pre-service payment
      canStartService: true,
      canConfirmPayment: false
    },
    phaseMetadata: {
      // Phase 2 cancellation matrix: allowed until service start
      cancelAllowed: true,
      cancelWindow: 'before-service-start',
      editWindow: 'governed-by-phase3-rules'
    }
  },

  /**
   * Service has started.
   * Ownership: transferred
   * Workflow: processing/in-service
   * Payment: may be unpaid or legacy-mapped
   */
  'processing': {
    fixtureId: 'processing',
    purpose: 'Service is in progress',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'claimed_user_openid',
      userId: 'claimed_user_id',

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.USED,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: new Date('2026-03-18T10:00:00.000Z'),

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.PROCESSING,
      status: 2, // legacy: PROCESSING

      // Payment markers
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: new Date('2026-03-19T09:00:00.000Z'),
      serviceCompletedAt: null,
      completeTime: null,

      // Confirmed content
      address: '已确认的详细地址',
      contactName: '已确认联系人',
      contactPhone: '13800138000',
      serviceTime: '2026-03-20 09:00',
      remark: '用户已确认备注'
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: 'n/a',
      canStartService: 'already-started',
      // Pre-service payment confirmation should not appear
      canConfirmPayment: false,
      canProgressService: true
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: true,
      canStartService: 'already-started',
      // Payment confirmation unavailable while paymentStatus=UNPAID
      // unless explicitly allowed by documented compatibility rule
      canConfirmPayment: false,
      canProgressService: true,
      canMarkServiceDone: true
    },
    phaseMetadata: {
      // Phase 3 edit-window rules govern append-item eligibility
      // Use properties, not alias fixture IDs like "processing-with-append-allowed"
      appendAllowed: true,
      editAllowed: 'governed-by-phase3-rules',
      cancelAllowed: false
    }
  },

  /**
   * Service complete, waiting for offline payment.
   * Ownership: transferred
   * Workflow: service-done, non-terminal
   * Payment: unpaid
   */
  'service-done-unpaid': {
    fixtureId: 'service-done-unpaid',
    purpose: 'Service completed, waiting for offline payment',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'claimed_user_openid',
      userId: 'claimed_user_id',

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.USED,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: new Date('2026-03-18T10:00:00.000Z'),

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.SERVICE_DONE,
      status: 5, // legacy: SERVED_UNPAID

      // Payment markers
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: new Date('2026-03-19T09:00:00.000Z'),
      serviceCompletedAt: new Date('2026-03-20T17:00:00.000Z'),
      completeTime: null,

      // Confirmed content
      address: '已确认的详细地址',
      contactName: '已确认联系人',
      contactPhone: '13800138000',
      serviceTime: '2026-03-20 09:00',
      remark: '用户已确认备注'
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: 'n/a',
      canStartService: 'already-done',
      // Payment confirmation IS available after service completion
      canConfirmPayment: true,
      isTerminal: false,
      isPayableCollectable: true
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: true,
      canStartService: 'already-done',
      // Payment confirmation is the remaining step before completion
      canConfirmPayment: true,
      isTerminal: false
    },
    phaseMetadata: {
      appendAllowed: false,
      editAllowed: false,
      cancelAllowed: false
    }
  },

  /**
   * Terminal fulfilled record.
   * Ownership: transferred
   * Workflow: completed (terminal)
   * Payment: paid
   */
  'completed': {
    fixtureId: 'completed',
    purpose: 'Terminal fulfilled record',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'claimed_user_openid',
      userId: 'claimed_user_id',

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.USED,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: new Date('2026-03-18T10:00:00.000Z'),

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.COMPLETED,
      status: 3, // legacy: COMPLETED

      // Payment markers
      paymentStatus: PAYMENT_STATUS.PAID,
      payTime: new Date('2026-03-21T14:00:00.000Z'),

      // Service timestamps
      processTime: new Date('2026-03-19T09:00:00.000Z'),
      serviceCompletedAt: new Date('2026-03-20T17:00:00.000Z'),
      completeTime: new Date('2026-03-21T14:00:00.000Z'),

      // Confirmed content
      address: '已确认的详细地址',
      contactName: '已确认联系人',
      contactPhone: '13800138000',
      serviceTime: '2026-03-20 09:00',
      remark: '用户已确认备注'
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: 'n/a',
      canStartService: false,
      canConfirmPayment: false,
      isTerminal: true,
      hasForwardWorkflowAction: false
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: true,
      firstClassConfirmation: true,
      canStartService: false,
      canConfirmPayment: false,
      isTerminal: true,
      hasForwardWorkflowAction: false
    },
    phaseMetadata: {
      appendAllowed: false,
      editAllowed: false,
      cancelAllowed: false
    }
  },

  /**
   * Terminal cancelled record.
   * Workflow: cancelled (terminal)
   */
  'cancelled': {
    fixtureId: 'cancelled',
    purpose: 'Terminal cancelled record',
    fields: {
      // Ownership markers
      waitForBind: false,
      userOpenid: 'admin_openid_placeholder',
      userId: null,

      // QR lifecycle markers
      qrCodeKey: 'qr_example_key',
      qrCodeStatus: QR_CODE_STATUS.PENDING,
      qrCodeExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      qrCodeUsedAt: null,

      // Workflow markers
      orderStatus: ORDER_FLOW_STATUS.CANCELLED,
      status: 4, // legacy: CANCELLED

      // Payment markers (may be legacy-mapped)
      paymentStatus: PAYMENT_STATUS.UNPAID,
      payTime: null,

      // Service timestamps
      processTime: null,
      serviceCompletedAt: null,
      completeTime: null
    },
    baselineExpectation: {
      isClaimable: false,
      ownershipTransferred: false,
      firstClassConfirmation: 'n/a',
      canStartService: false,
      canConfirmPayment: false,
      isTerminal: true,
      hasForwardWorkflowAction: false
    },
    targetExpectation: {
      isClaimable: false,
      ownershipTransferred: false,
      firstClassConfirmation: false,
      canStartService: false,
      canConfirmPayment: false,
      isTerminal: true,
      hasForwardWorkflowAction: false
    },
    phaseMetadata: {
      cancelAllowed: false // already cancelled
    }
  }
};

// ============================================================================
// TRANSITION MATRIX (aligned with Appendix C)
// ============================================================================

/**
 * Transition matrix defining allowed state transitions.
 * @typedef {Object} Transition
 * @property {string} from - Source fixture ID
 * @property {string} trigger - Triggering operation
 * @property {string} to - Target fixture ID
 * @property {boolean} allowedInBaseline - Whether allowed in current repo
 * @property {boolean} allowedInTarget - Whether allowed post-refactor
 * @property {string} [notes] - Additional notes
 */

const TRANSITIONS = [
  {
    from: 'unclaimed-admin-created',
    trigger: 'bindOrder',
    to: 'claimed-unconfirmed',
    allowedInBaseline: true,
    allowedInTarget: true,
    notes: 'Ownership transfer only; no payment change'
  },
  {
    from: 'claimed-unconfirmed',
    trigger: 'updateOrderUserInfo',
    to: 'confirmed-ready-for-service',
    allowedInBaseline: false,
    allowedInTarget: true,
    notes: 'First structural workflow change (Phase 1). Baseline: not as first-class state.'
  },
  {
    from: 'claimed-unconfirmed',
    trigger: 'updateOrderUserInfo',
    to: 'claimed-unconfirmed', // stays in pre-service without distinct confirmation
    allowedInBaseline: true,
    allowedInTarget: false,
    notes: 'Baseline compatibility behavior: confirmation not first-class'
  },
  {
    from: 'confirmed-ready-for-service',
    trigger: 'adminStartService',
    to: 'processing',
    allowedInBaseline: false,
    allowedInTarget: true,
    notes: 'Not first-class in baseline. Service start gated by confirmation, not pre-service payment.'
  },
  {
    from: 'processing',
    trigger: 'adminMarkServiceDone',
    to: 'service-done-unpaid',
    allowedInBaseline: true,
    allowedInTarget: true,
    notes: 'Offline payment still pending'
  },
  {
    from: 'service-done-unpaid',
    trigger: 'adminConfirmPayment',
    to: 'completed',
    allowedInBaseline: true,
    allowedInTarget: true,
    notes: 'Terminal completion after offline settlement'
  },
  {
    from: 'unclaimed-admin-created',
    trigger: 'adminCancel',
    to: 'cancelled',
    allowedInBaseline: true,
    allowedInTarget: true,
    notes: 'Early cancel remains valid'
  },
  {
    from: 'claimed-unconfirmed',
    trigger: 'adminCancel',
    to: 'cancelled',
    allowedInBaseline: true,
    allowedInTarget: true,
    notes: 'Cancellation allowed pre-service before service start'
  },
  {
    from: 'confirmed-ready-for-service',
    trigger: 'adminCancel',
    to: 'cancelled',
    allowedInBaseline: false, // not first-class
    allowedInTarget: true,
    notes: 'Cancellation allowed before service start; baseline treats this as pre-service'
  },
  {
    from: 'processing',
    trigger: 'adminAddItems',
    to: 'processing',
    allowedInBaseline: true, // compatibility-dependent
    allowedInTarget: true,
    notes: 'Non-terminal self-transition with content change only. Phase 3 edit-window rules apply.'
  },
  {
    from: 'completed',
    trigger: 'anyForwardWorkflow',
    to: null,
    allowedInBaseline: false,
    allowedInTarget: false,
    notes: 'Terminal state - no forward transitions'
  },
  {
    from: 'cancelled',
    trigger: 'anyForwardWorkflow',
    to: null,
    allowedInBaseline: false,
    allowedInTarget: false,
    notes: 'Terminal state - no forward transitions'
  }
];

// ============================================================================
// HELPER FUNCTIONS FOR VERIFICATION SCRIPTS
// ============================================================================

/**
 * Get all canonical fixture IDs.
 * @returns {string[]} Array of fixture IDs
 */
function getCanonicalFixtureIds() {
  return Object.keys(FIXTURES);
}

/**
 * Get a fixture by ID.
 * @param {string} fixtureId - Canonical fixture ID
 * @returns {Object|undefined} Fixture object or undefined if not found
 */
function getFixture(fixtureId) {
  return FIXTURES[fixtureId];
}

/**
 * Get all fixtures.
 * @returns {Object} All fixtures
 */
function getAllFixtures() {
  return { ...FIXTURES };
}

/**
 * Get all transitions.
 * @returns {Transition[]} Array of transitions
 */
function getAllTransitions() {
  return [...TRANSITIONS];
}

/**
 * Get transitions from a specific fixture.
 * @param {string} fixtureId - Source fixture ID
 * @returns {Transition[]} Array of transitions from the fixture
 */
function getTransitionsFrom(fixtureId) {
  return TRANSITIONS.filter(t => t.from === fixtureId);
}

/**
 * Get transitions to a specific fixture.
 * @param {string} fixtureId - Target fixture ID
 * @returns {Transition[]} Array of transitions to the fixture
 */
function getTransitionsTo(fixtureId) {
  return TRANSITIONS.filter(t => t.to === fixtureId);
}

/**
 * Get baseline expectations for a fixture.
 * @param {string} fixtureId - Canonical fixture ID
 * @returns {Object|undefined} Baseline expectations or undefined
 */
function getBaselineExpectation(fixtureId) {
  const fixture = FIXTURES[fixtureId];
  return fixture ? fixture.baselineExpectation : undefined;
}

/**
 * Get target expectations for a fixture.
 * @param {string} fixtureId - Canonical fixture ID
 * @returns {Object|undefined} Target expectations or undefined
 */
function getTargetExpectation(fixtureId) {
  const fixture = FIXTURES[fixtureId];
  return fixture ? fixture.targetExpectation : undefined;
}

/**
 * Get phase metadata for a fixture.
 * @param {string} fixtureId - Canonical fixture ID
 * @returns {Object|undefined} Phase metadata or undefined
 */
function getPhaseMetadata(fixtureId) {
  const fixture = FIXTURES[fixtureId];
  return fixture ? fixture.phaseMetadata : undefined;
}

/**
 * Check if a transition is allowed in baseline.
 * @param {string} from - Source fixture ID
 * @param {string} trigger - Triggering operation
 * @returns {boolean|null} true if allowed, false if not, null if transition not found
 */
function isTransitionAllowedInBaseline(from, trigger) {
  const transition = TRANSITIONS.find(t => t.from === from && t.trigger === trigger);
  return transition ? transition.allowedInBaseline : null;
}

/**
 * Check if a transition is allowed in target.
 * @param {string} from - Source fixture ID
 * @param {string} trigger - Triggering operation
 * @returns {boolean|null} true if allowed, false if not, null if transition not found
 */
function isTransitionAllowedInTarget(from, trigger) {
  const transition = TRANSITIONS.find(t => t.from === from && t.trigger === trigger);
  return transition ? transition.allowedInTarget : null;
}

/**
 * Validate that all fixture IDs in transitions exist in FIXTURES.
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateTransitionFixtureIds() {
  const errors = [];
  const fixtureIds = new Set(Object.keys(FIXTURES));

  TRANSITIONS.forEach((transition, index) => {
    if (transition.from && !fixtureIds.has(transition.from)) {
      errors.push(`Transition ${index}: unknown 'from' fixture "${transition.from}"`);
    }
    if (transition.to !== null && transition.to && !fixtureIds.has(transition.to)) {
      errors.push(`Transition ${index}: unknown 'to' fixture "${transition.to}"`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get fixtures that are terminal (no forward workflow actions).
 * @returns {string[]} Array of terminal fixture IDs
 */
function getTerminalFixtures() {
  return Object.entries(FIXTURES)
    .filter(([_, fixture]) => fixture.targetExpectation?.isTerminal === true)
    .map(([id]) => id);
}

/**
 * Get fixtures that require first-class confirmation in target.
 * @returns {string[]} Array of fixture IDs with first-class confirmation
 */
function getConfirmationFirstClassFixtures() {
  return Object.entries(FIXTURES)
    .filter(([_, fixture]) => fixture.targetExpectation?.firstClassConfirmation === true)
    .map(([id]) => id);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // State value constants
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  QR_CODE_STATUS,

  // Core data
  FIXTURES,
  TRANSITIONS,

  // Fixture helpers
  getCanonicalFixtureIds,
  getFixture,
  getAllFixtures,
  getBaselineExpectation,
  getTargetExpectation,
  getPhaseMetadata,

  // Transition helpers
  getAllTransitions,
  getTransitionsFrom,
  getTransitionsTo,
  isTransitionAllowedInBaseline,
  isTransitionAllowedInTarget,
  validateTransitionFixtureIds,

  // Query helpers
  getTerminalFixtures,
  getConfirmationFirstClassFixtures
};
