#!/usr/bin/env node
/**
 * @fileoverview Baseline verifier for order workflow fixtures.
 *
 * This script validates current-state (baseline) invariants for the canonical
 * order workflow fixtures WITHOUT any cloud runtime dependencies.
 *
 * Phase: 0B — Baseline verifier
 * Depends on: scripts/fixtures/order-workflow-fixtures.js (Phase 0A)
 *
 * Exit codes:
 *   0 — All baseline invariants satisfied
 *   1 — One or more baseline invariants violated
 */

'use strict';

const assert = require('assert');

// Import canonical fixture source
const {
  getCanonicalFixtureIds,
  getFixture,
  getAllFixtures,
  getAllTransitions,
  getTransitionsFrom,
  getBaselineExpectation,
  isTransitionAllowedInBaseline,
  validateTransitionFixtureIds
} = require('./fixtures/order-workflow-fixtures.js');

// ============================================================================
// EXPECTED CANONICAL FIXTURE IDS (must match plan exactly)
// ============================================================================

const EXPECTED_FIXTURE_IDS = [
  'unclaimed-admin-created',
  'claimed-unconfirmed',
  'confirmed-ready-for-service',
  'processing',
  'service-done-unpaid',
  'completed',
  'cancelled'
];

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verify exactly the canonical fixture IDs exist in the fixture module.
 */
function verifyCanonicalFixtureIds() {
  const actualIds = getCanonicalFixtureIds();
  const expectedSet = new Set(EXPECTED_FIXTURE_IDS);
  const actualSet = new Set(actualIds);

  // Check no missing fixtures
  for (const id of EXPECTED_FIXTURE_IDS) {
    assert.ok(actualSet.has(id), `Missing canonical fixture: ${id}`);
  }

  // Check no extra fixtures
  for (const id of actualIds) {
    assert.ok(expectedSet.has(id), `Unexpected fixture ID: ${id}`);
  }

  // Check exact count
  assert.strictEqual(
    actualIds.length,
    EXPECTED_FIXTURE_IDS.length,
    `Expected ${EXPECTED_FIXTURE_IDS.length} fixtures, got ${actualIds.length}`
  );

  console.log('[verify-order-workflow-baseline] canonical fixture IDs: PASS');
}

/**
 * Verify all transition fixture references are valid.
 */
function verifyTransitionFixtureReferences() {
  const result = validateTransitionFixtureIds();

  assert.ok(
    result.valid,
    `Invalid transition fixture references: ${result.errors.join('; ')}`
  );

  console.log('[verify-order-workflow-baseline] transition fixture references: PASS');
}

/**
 * Verify baseline transition contract is internally consistent.
 */
function verifyBaselineTransitionConsistency() {
  const transitions = getAllTransitions();

  // Check that each transition has well-formed allowedInBaseline flag
  for (const t of transitions) {
    assert.ok(
      typeof t.allowedInBaseline === 'boolean',
      `Transition ${t.from} -> ${t.to} (${t.trigger}) has non-boolean allowedInBaseline`
    );
  }

  console.log('[verify-order-workflow-baseline] baseline transition consistency: PASS');
}

/**
 * Verify claimed-unconfirmed exists as ownership-transferred / pre-confirmation fixture.
 */
function verifyClaimedUnconfirmedFixture() {
  const fixture = getFixture('claimed-unconfirmed');

  assert.ok(fixture, 'claimed-unconfirmed fixture must exist');

  // Check ownership transfer markers
  assert.strictEqual(fixture.fields.waitForBind, false, 'claimed-unconfirmed: waitForBind must be false');
  assert.ok(fixture.fields.userId, 'claimed-unconfirmed: userId must be set (ownership transferred)');

  // Check QR lifecycle: used
  assert.strictEqual(fixture.fields.qrCodeStatus, 'used', 'claimed-unconfirmed: qrCodeStatus must be "used"');

  // Check baseline expectation
  const baseline = getBaselineExpectation('claimed-unconfirmed');
  assert.ok(baseline, 'claimed-unconfirmed: must have baselineExpectation');
  assert.strictEqual(baseline.ownershipTransferred, true, 'claimed-unconfirmed: ownershipTransferred must be true');
  assert.strictEqual(baseline.firstClassConfirmation, false, 'claimed-unconfirmed: firstClassConfirmation must be false in baseline');

  console.log('[verify-order-workflow-baseline] claimed-unconfirmed fixture: PASS');
}

/**
 * Verify confirmed-ready-for-service exists but is NOT first-class distinct in baseline.
 */
function verifyConfirmedReadyForServiceNotFirstClassInBaseline() {
  const fixture = getFixture('confirmed-ready-for-service');

  assert.ok(fixture, 'confirmed-ready-for-service fixture must exist');

  // Check baseline expectation
  const baseline = getBaselineExpectation('confirmed-ready-for-service');
  assert.ok(baseline, 'confirmed-ready-for-service: must have baselineExpectation');

  // CRITICAL: In baseline, confirmation is NOT first-class
  assert.strictEqual(
    baseline.firstClassConfirmation,
    false,
    'confirmed-ready-for-service: firstClassConfirmation must be false in baseline'
  );

  // CRITICAL: In baseline, it is NOT distinct from claimed semantics
  assert.strictEqual(
    baseline.isDistinctFromClaimed,
    false,
    'confirmed-ready-for-service: isDistinctFromClaimed must be false in baseline (collapses to claimed)'
  );

  console.log('[verify-order-workflow-baseline] confirmed-ready-for-service NOT first-class: PASS');
}

/**
 * Verify baseline allows bindOrder from unclaimed-admin-created to claimed-unconfirmed.
 */
function verifyBaselineAllowsBindOrder() {
  const allowed = isTransitionAllowedInBaseline('unclaimed-admin-created', 'bindOrder');

  assert.strictEqual(
    allowed,
    true,
    'Baseline MUST allow bindOrder: unclaimed-admin-created -> claimed-unconfirmed'
  );

  console.log('[verify-order-workflow-baseline] bindOrder allowed in baseline: PASS');
}

/**
 * Verify baseline does NOT allow claimed-unconfirmed -> confirmed-ready-for-service
 * as a first-class transition.
 */
function verifyBaselineDisallowsFirstClassConfirmationTransition() {
  // The transition to confirmed-ready-for-service via updateOrderUserInfo
  // has allowedInBaseline: false because confirmation is not first-class
  const allowed = isTransitionAllowedInBaseline('claimed-unconfirmed', 'updateOrderUserInfo');

  // In baseline, this transition results in staying in claimed-unconfirmed
  // (allowedInBaseline: true for self-transition, false for first-class confirmation)
  // We need to find the specific transition to confirmed-ready-for-service
  const transitions = getTransitionsFrom('claimed-unconfirmed');

  const toConfirmedTransition = transitions.find(
    t => t.trigger === 'updateOrderUserInfo' && t.to === 'confirmed-ready-for-service'
  );

  assert.ok(
    toConfirmedTransition,
    'Transition claimed-unconfirmed -> confirmed-ready-for-service must exist in transition matrix'
  );

  assert.strictEqual(
    toConfirmedTransition.allowedInBaseline,
    false,
    'Baseline MUST NOT allow claimed-unconfirmed -> confirmed-ready-for-service as first-class transition'
  );

  console.log('[verify-order-workflow-baseline] first-class confirmation transition disallowed: PASS');
}

/**
 * Verify baseline allows processing -> service-done-unpaid.
 */
function verifyBaselineAllowsProcessingToServiceDone() {
  const allowed = isTransitionAllowedInBaseline('processing', 'adminMarkServiceDone');

  assert.strictEqual(
    allowed,
    true,
    'Baseline MUST allow processing -> service-done-unpaid via adminMarkServiceDone'
  );

  console.log('[verify-order-workflow-baseline] processing -> service-done-unpaid allowed: PASS');
}

/**
 * Verify baseline allows service-done-unpaid -> completed.
 */
function verifyBaselineAllowsServiceDoneToCompleted() {
  const allowed = isTransitionAllowedInBaseline('service-done-unpaid', 'adminConfirmPayment');

  assert.strictEqual(
    allowed,
    true,
    'Baseline MUST allow service-done-unpaid -> completed via adminConfirmPayment'
  );

  console.log('[verify-order-workflow-baseline] service-done-unpaid -> completed allowed: PASS');
}

/**
 * Verify terminal states have no forward workflow actions in baseline.
 */
function verifyTerminalStatesBaseline() {
  const completedBaseline = getBaselineExpectation('completed');
  const cancelledBaseline = getBaselineExpectation('cancelled');

  assert.strictEqual(completedBaseline.isTerminal, true, 'completed: must be terminal');
  assert.strictEqual(completedBaseline.hasForwardWorkflowAction, false, 'completed: no forward workflow');

  assert.strictEqual(cancelledBaseline.isTerminal, true, 'cancelled: must be terminal');
  assert.strictEqual(cancelledBaseline.hasForwardWorkflowAction, false, 'cancelled: no forward workflow');

  // Verify transitions from terminal states are disallowed
  const anyFromCompleted = isTransitionAllowedInBaseline('completed', 'anyForwardWorkflow');
  const anyFromCancelled = isTransitionAllowedInBaseline('cancelled', 'anyForwardWorkflow');

  assert.strictEqual(anyFromCompleted, false, 'completed: anyForwardWorkflow must be disallowed');
  assert.strictEqual(anyFromCancelled, false, 'cancelled: anyForwardWorkflow must be disallowed');

  console.log('[verify-order-workflow-baseline] terminal states: PASS');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('[verify-order-workflow-baseline] Starting baseline invariant verification...');

  // Run all verification functions
  verifyCanonicalFixtureIds();
  verifyTransitionFixtureReferences();
  verifyBaselineTransitionConsistency();
  verifyClaimedUnconfirmedFixture();
  verifyConfirmedReadyForServiceNotFirstClassInBaseline();
  verifyBaselineAllowsBindOrder();
  verifyBaselineDisallowsFirstClassConfirmationTransition();
  verifyBaselineAllowsProcessingToServiceDone();
  verifyBaselineAllowsServiceDoneToCompleted();
  verifyTerminalStatesBaseline();

  // All verifications passed
  console.log('');
  console.log('[verify-order-workflow-baseline] ========================================');
  console.log('[verify-order-workflow-baseline] STATE=BASELINE-LOCKED');
  console.log('[verify-order-workflow-baseline] PASS');
  console.log('[verify-order-workflow-baseline] ========================================');

  process.exit(0);
}

// Run main
main();
