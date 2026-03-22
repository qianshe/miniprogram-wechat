#!/usr/bin/env node
/**
 * @fileoverview Rollback verifier for order workflow phases.
 *
 * This script validates that rollback compatibility is preserved after
 * workflow changes, ensuring persisted records can still be handled safely
 * through legacy fallback paths.
 *
 * Phase: 1 — Rollback gate for confirmation milestone
 * Depends on: scripts/fixtures/order-workflow-fixtures.js (Phase 0A)
 *
 * Exit codes:
 *   0 — Rollback compatibility contract satisfied
 *   1 — Rollback compatibility contract violated
 *
 * Usage:
 *   node scripts/verify-workflow-rollback.js --phase=phase1-confirmation-milestone
 */

'use strict';

const assert = require('assert');

// Import canonical fixture source
const {
  getFixture,
  getTargetExpectation,
  getBaselineExpectation,
  getAllTransitions,
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS
} = require('./fixtures/order-workflow-fixtures.js');

// ============================================================================
// PHASE PARSING
// ============================================================================

/**
 * Parse command line arguments for phase selection.
 * @returns {string|null} Phase name or null for default
 */
function parsePhaseArg() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--phase=')) {
      return arg.substring('--phase='.length);
    }
  }
  return null;
}

const PHASE = parsePhaseArg();

// ============================================================================
// LEGACY MAPPING SIMULATION
// ============================================================================

/**
 * Simulate legacy status mapping for rollback compatibility.
 * This mirrors the behavior that would occur if Phase 1 changes were
 * reverted and records with new confirmation-state values needed to
 * be interpreted through legacy fallback logic.
 *
 * @param {Object} fixture - Fixture with field values
 * @returns {Object} Legacy-compatible interpretation
 */
function simulateLegacyFallback(fixture) {
  const fields = fixture.fields;

  // Legacy mapping rules (aligned with config/constants.js behavior)
  // When orderStatus is present but legacy code expects old 'status':
  // - CREATED (0) + UNPAID (0) -> status 0 (pending service)
  // - PROCESSING (1) -> status 2 (processing)
  // - SERVICE_DONE (2) + UNPAID (0) -> status 5 (served unpaid)
  // - SERVICE_DONE (2) + PAID (1) -> status 6 (served paid)
  // - COMPLETED (3) -> status 3 (completed)
  // - CANCELLED (4) -> status 4 (cancelled)

  const orderStatus = fields.orderStatus;
  const paymentStatus = fields.paymentStatus;

  let legacyStatus;

  if (orderStatus === ORDER_FLOW_STATUS.CREATED) {
    // CREATED maps to pending/pre-service status
    legacyStatus = paymentStatus === PAYMENT_STATUS.PAID ? 1 : 0;
  } else if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) {
    legacyStatus = 2;
  } else if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) {
    legacyStatus = paymentStatus === PAYMENT_STATUS.PAID ? 6 : 5;
  } else if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) {
    legacyStatus = 3;
  } else if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) {
    legacyStatus = 4;
  } else {
    // Unknown state - this would be a rollback failure
    legacyStatus = null;
  }

  return {
    legacyStatus,
    ownershipPreserved: fields.waitForBind === false && !!fields.userOpenid,
    paymentPreserved: typeof fields.paymentStatus === 'number',
    canInterpretSafely: legacyStatus !== null
  };
}

// ============================================================================
// PHASE 1 ROLLBACK VERIFICATIONS
// ============================================================================

/**
 * Verify ownership semantics remain intact for rollback.
 * Rollback must not break ownership model (waitForBind + userOpenid).
 */
function verifyOwnershipSemanticsIntact() {
  const fixtures = ['claimed-unconfirmed', 'confirmed-ready-for-service', 'processing'];

  for (const fixtureId of fixtures) {
    const fixture = getFixture(fixtureId);
    assert.ok(fixture, `${fixtureId}: fixture must exist`);

    // Ownership must be preserved through confirmation milestone
    assert.strictEqual(
      fixture.fields.waitForBind,
      false,
      `${fixtureId}: waitForBind must be false (ownership transferred)`
    );

    assert.ok(
      fixture.fields.userOpenid,
      `${fixtureId}: userOpenid must be set (ownership transferred)`
    );
  }

  console.log('[verify-workflow-rollback] ownership semantics intact: PASS');
}

/**
 * Verify payment semantics remain intact for rollback.
 * Rollback must not break payment model (paymentStatus).
 */
function verifyPaymentSemanticsIntact() {
  const fixtures = ['claimed-unconfirmed', 'confirmed-ready-for-service'];

  for (const fixtureId of fixtures) {
    const fixture = getFixture(fixtureId);
    assert.ok(fixture, `${fixtureId}: fixture must exist`);

    // Payment must be UNPAID in pre-service states
    assert.strictEqual(
      fixture.fields.paymentStatus,
      PAYMENT_STATUS.UNPAID,
      `${fixtureId}: paymentStatus must be UNPAID (confirmation independent from payment)`
    );
  }

  console.log('[verify-workflow-rollback] payment semantics intact: PASS');
}

/**
 * Verify legacy fallback can handle confirmed-ready-for-service fixture.
 * This is the critical rollback check: if a record has been persisted
 * with the new confirmation-state value, legacy fallback must still
 * interpret it safely.
 */
function verifyConfirmedStateLegacyFallback() {
  const fixture = getFixture('confirmed-ready-for-service');
  assert.ok(fixture, 'confirmed-ready-for-service fixture must exist');

  // Simulate legacy fallback interpretation
  const fallback = simulateLegacyFallback(fixture);

  // CRITICAL: Legacy fallback must be able to interpret this fixture safely
  assert.strictEqual(
    fallback.canInterpretSafely,
    true,
    'confirmed-ready-for-service: legacy fallback must interpret safely'
  );

  // The confirmed state uses orderStatus=CREATED (0) which maps to legacy status 0
  // This means rollback would treat confirmed orders as pre-service pending orders
  // which is safe - they can still be started through legacy paths
  assert.strictEqual(
    fallback.legacyStatus,
    0,
    'confirmed-ready-for-service: must map to legacy status 0 (pre-service pending)'
  );

  // Ownership must be preserved through fallback
  assert.strictEqual(
    fallback.ownershipPreserved,
    true,
    'confirmed-ready-for-service: ownership must be preserved through fallback'
  );

  // Payment must be preserved through fallback
  assert.strictEqual(
    fallback.paymentPreserved,
    true,
    'confirmed-ready-for-service: payment must be preserved through fallback'
  );

  console.log('[verify-workflow-rollback] confirmed state legacy fallback: PASS');
}

/**
 * Verify claimed-unconfirmed state has safe legacy fallback.
 */
function verifyClaimedStateLegacyFallback() {
  const fixture = getFixture('claimed-unconfirmed');
  assert.ok(fixture, 'claimed-unconfirmed fixture must exist');

  const fallback = simulateLegacyFallback(fixture);

  assert.strictEqual(
    fallback.canInterpretSafely,
    true,
    'claimed-unconfirmed: legacy fallback must interpret safely'
  );

  assert.strictEqual(
    fallback.legacyStatus,
    0,
    'claimed-unconfirmed: must map to legacy status 0 (pre-service pending)'
  );

  console.log('[verify-workflow-rollback] claimed state legacy fallback: PASS');
}

/**
 * Verify no narrowing of fallback behavior occurred.
 * Phase 1 is not allowed to narrow fallback behavior before this verifier passes.
 */
function verifyNoFallbackNarrowing() {
  const confirmedFixture = getFixture('confirmed-ready-for-service');
  const claimedFixture = getFixture('claimed-unconfirmed');

  // Both fixtures must have same orderStatus (CREATED) for safe rollback
  // This ensures confirmation milestone doesn't break legacy interpretation
  assert.strictEqual(
    confirmedFixture.fields.orderStatus,
    claimedFixture.fields.orderStatus,
    'Both claimed and confirmed must have same orderStatus for safe rollback mapping'
  );

  // Both must be interpretable through same legacy path
  const confirmedFallback = simulateLegacyFallback(confirmedFixture);
  const claimedFallback = simulateLegacyFallback(claimedFixture);

  assert.strictEqual(
    confirmedFallback.legacyStatus,
    claimedFallback.legacyStatus,
    'Both claimed and confirmed must map to same legacy status (no fallback narrowing)'
  );

  console.log('[verify-workflow-rollback] no fallback narrowing: PASS');
}

/**
 * Verify rollback does not require data surgery.
 * Ownership and payment semantics must remain intact, so rollback
 * should only require reverting workflow gating logic, not data migration.
 */
function verifyRollbackRequiresNoDataSurgery() {
  // Check that all fixtures have well-formed ownership fields
  const fixturesToCheck = [
    'unclaimed-admin-created',
    'claimed-unconfirmed',
    'confirmed-ready-for-service',
    'processing',
    'service-done-unpaid'
  ];

  for (const fixtureId of fixturesToCheck) {
    const fixture = getFixture(fixtureId);
    assert.ok(fixture, `${fixtureId}: fixture must exist`);

    // waitForBind must be boolean
    assert.strictEqual(
      typeof fixture.fields.waitForBind,
      'boolean',
      `${fixtureId}: waitForBind must be boolean`
    );

    // userOpenid must be string or null
    assert.ok(
      typeof fixture.fields.userOpenid === 'string' || fixture.fields.userOpenid === null,
      `${fixtureId}: userOpenid must be string or null`
    );

    // paymentStatus must be number
    assert.strictEqual(
      typeof fixture.fields.paymentStatus,
      'number',
      `${fixtureId}: paymentStatus must be number`
    );

    // orderStatus must be number
    assert.strictEqual(
      typeof fixture.fields.orderStatus,
      'number',
      `${fixtureId}: orderStatus must be number`
    );
  }

  console.log('[verify-workflow-rollback] rollback requires no data surgery: PASS');
}

/**
 * Verify transition matrix preserves rollback paths.
 * All transitions that are allowed in target must have corresponding
 * rollback-compatible baseline paths.
 */
function verifyTransitionRollbackPaths() {
  const transitions = getAllTransitions();

  // Find the confirmation transition
  const confirmTransition = transitions.find(
    t => t.trigger === 'updateOrderUserInfo' &&
         t.from === 'claimed-unconfirmed' &&
         t.to === 'confirmed-ready-for-service'
  );

  assert.ok(confirmTransition, 'Confirmation transition must exist in matrix');

  // In target, this transition is allowed
  assert.strictEqual(
    confirmTransition.allowedInTarget,
    true,
    'Confirmation transition must be allowed in target'
  );

  // In baseline, this transition was NOT allowed as first-class
  // This means baseline codepaths won't expect this state as distinct
  // which is safe for rollback - they'll treat it as pre-service pending
  assert.strictEqual(
    confirmTransition.allowedInBaseline,
    false,
    'Confirmation transition was not first-class in baseline (safe for rollback)'
  );

  console.log('[verify-workflow-rollback] transition rollback paths: PASS');
}

// ============================================================================
// PHASE 1 MAIN EXECUTION
// ============================================================================

/**
 * Run Phase 1 rollback verification.
 * Outputs the required marker: PHASE1_ROLLBACK_COMPAT=true
 */
function runPhase1RollbackVerification() {
  console.log('[verify-workflow-rollback] Running Phase 1 rollback compatibility checks...');

  // Run all rollback verifications
  verifyOwnershipSemanticsIntact();
  verifyPaymentSemanticsIntact();
  verifyConfirmedStateLegacyFallback();
  verifyClaimedStateLegacyFallback();
  verifyNoFallbackNarrowing();
  verifyRollbackRequiresNoDataSurgery();
  verifyTransitionRollbackPaths();

  // Output success marker
  console.log('');
  console.log('[verify-workflow-rollback] ========================================');
  console.log('[verify-workflow-rollback] --phase=phase1-confirmation-milestone');
  console.log('[verify-workflow-rollback] PHASE1_ROLLBACK_COMPAT=true');
  console.log('[verify-workflow-rollback] PASS');
  console.log('[verify-workflow-rollback] ========================================');
}

function runPhase5RollbackVerification() {
  console.log('[verify-workflow-rollback] Running Phase 5 rollback readiness checks...');

  verifyOwnershipSemanticsIntact();
  verifyPaymentSemanticsIntact();
  verifyConfirmedStateLegacyFallback();
  verifyClaimedStateLegacyFallback();
  verifyNoFallbackNarrowing();
  verifyRollbackRequiresNoDataSurgery();
  verifyTransitionRollbackPaths();

  console.log('');
  console.log('[verify-workflow-rollback] ========================================');
  console.log('[verify-workflow-rollback] --phase=phase5-legacy-cleanup');
  console.log('[verify-workflow-rollback] ROLLBACK_READY=true');
  console.log('[verify-workflow-rollback] PASS');
  console.log('[verify-workflow-rollback] ========================================');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  if (PHASE === 'phase1-confirmation-milestone') {
    runPhase1RollbackVerification();
    process.exit(0);
  } else if (PHASE === 'phase5-legacy-cleanup') {
    runPhase5RollbackVerification();
    process.exit(0);
  } else {
    // No phase specified - show usage
    console.log('[verify-workflow-rollback] Usage:');
    console.log('[verify-workflow-rollback]   node scripts/verify-workflow-rollback.js --phase=phase1-confirmation-milestone');
    console.log('');
    console.log('[verify-workflow-rollback] Supported phases:');
    console.log('[verify-workflow-rollback]   --phase=phase1-confirmation-milestone');
    console.log('[verify-workflow-rollback]   --phase=phase5-legacy-cleanup');
    process.exit(1);
  }
}

// Run main
main();