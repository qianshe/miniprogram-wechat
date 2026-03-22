#!/usr/bin/env node
/**
 * @fileoverview Target verifier for order workflow fixtures.
 *
 * This script validates target-state (post-refactor) invariants for the canonical
 * order workflow fixtures WITHOUT any cloud runtime dependencies.
 *
 * Phase: 0C — Target verifier
 * Depends on: scripts/fixtures/order-workflow-fixtures.js (Phase 0A)
 *
 * Exit codes:
 *   0 — All target invariants satisfied
 *   1 — One or more target invariants violated
 *
 * Usage:
 *   node scripts/verify-order-workflow-target.js
 *   node scripts/verify-order-workflow-target.js --phase=phase1-confirmation-milestone
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
  getTargetExpectation,
  isTransitionAllowedInTarget,
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
// PHASE PARSING
// ============================================================================

/**
 * Parse command line arguments for phase selection.
 * @returns {string|null} Phase name or null for default all-target checks
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

  console.log('[verify-order-workflow-target] canonical fixture IDs: PASS');
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

  console.log('[verify-order-workflow-target] transition fixture references: PASS');
}

/**
 * Verify target transition contract is internally consistent.
 */
function verifyTargetTransitionConsistency() {
  const transitions = getAllTransitions();

  // Check that each transition has well-formed allowedInTarget flag
  for (const t of transitions) {
    assert.ok(
      typeof t.allowedInTarget === 'boolean',
      `Transition ${t.from} -> ${t.to} (${t.trigger}) has non-boolean allowedInTarget`
    );
  }

  console.log('[verify-order-workflow-target] target transition consistency: PASS');
}

/**
 * Verify claimed-unconfirmed is ownership-transferred but NOT confirmed in target.
 * Proves claim does NOT imply confirmation.
 */
function verifyClaimedUnconfirmedDistinctFromConfirmed() {
  const fixture = getFixture('claimed-unconfirmed');

  assert.ok(fixture, 'claimed-unconfirmed fixture must exist');

  // Check ownership transfer markers
  assert.strictEqual(fixture.fields.waitForBind, false, 'claimed-unconfirmed: waitForBind must be false');
  assert.ok(fixture.fields.userId, 'claimed-unconfirmed: userId must be set (ownership transferred)');

  // Check QR lifecycle: used
  assert.strictEqual(fixture.fields.qrCodeStatus, 'used', 'claimed-unconfirmed: qrCodeStatus must be "used"');

  // Check target expectation
  const target = getTargetExpectation('claimed-unconfirmed');
  assert.ok(target, 'claimed-unconfirmed: must have targetExpectation');
  assert.strictEqual(target.ownershipTransferred, true, 'claimed-unconfirmed: ownershipTransferred must be true in target');
  assert.strictEqual(target.firstClassConfirmation, false, 'claimed-unconfirmed: firstClassConfirmation must be false (claim != confirm)');
  assert.strictEqual(target.canStartService, false, 'claimed-unconfirmed: canStartService must be false (needs confirmation first)');

  console.log('[verify-order-workflow-target] claimed-unconfirmed distinct from confirmed: PASS');
}

/**
 * Verify confirmed-ready-for-service IS first-class and distinct from claimed in target.
 */
function verifyConfirmedReadyForServiceIsFirstClass() {
  const fixture = getFixture('confirmed-ready-for-service');

  assert.ok(fixture, 'confirmed-ready-for-service fixture must exist');

  // Check target expectation
  const target = getTargetExpectation('confirmed-ready-for-service');
  assert.ok(target, 'confirmed-ready-for-service: must have targetExpectation');

  // CRITICAL: In target, confirmation IS first-class
  assert.strictEqual(
    target.firstClassConfirmation,
    true,
    'confirmed-ready-for-service: firstClassConfirmation must be true in target'
  );

  // CRITICAL: In target, it IS distinct from claimed semantics
  assert.strictEqual(
    target.isDistinctFromClaimed,
    true,
    'confirmed-ready-for-service: isDistinctFromClaimed must be true in target'
  );

  // CRITICAL: Service start is now available without pre-service payment
  assert.strictEqual(
    target.canStartService,
    true,
    'confirmed-ready-for-service: canStartService must be true in target (gated by confirmation, not payment)'
  );

  // Payment remains independent
  assert.strictEqual(
    target.canConfirmPayment,
    false,
    'confirmed-ready-for-service: canConfirmPayment must be false (payment independent)'
  );

  console.log('[verify-order-workflow-target] confirmed-ready-for-service is first-class: PASS');
}

/**
 * Verify claimed-unconfirmed and confirmed-ready-for-service are distinct in target.
 */
function verifyClaimedAndConfirmedAreDistinctStates() {
  const claimedTarget = getTargetExpectation('claimed-unconfirmed');
  const confirmedTarget = getTargetExpectation('confirmed-ready-for-service');

  assert.ok(claimedTarget, 'claimed-unconfirmed must have targetExpectation');
  assert.ok(confirmedTarget, 'confirmed-ready-for-service must have targetExpectation');

  // firstClassConfirmation differs
  assert.strictEqual(claimedTarget.firstClassConfirmation, false, 'claimed: firstClassConfirmation=false');
  assert.strictEqual(confirmedTarget.firstClassConfirmation, true, 'confirmed: firstClassConfirmation=true');

  // canStartService differs
  assert.strictEqual(claimedTarget.canStartService, false, 'claimed: canStartService=false');
  assert.strictEqual(confirmedTarget.canStartService, true, 'confirmed: canStartService=true');

  // isDistinctFromClaimed differs
  assert.strictEqual(claimedTarget.isDistinctFromClaimed !== true, true, 'claimed: isDistinctFromClaimed is not true');
  assert.strictEqual(confirmedTarget.isDistinctFromClaimed, true, 'confirmed: isDistinctFromClaimed=true');

  console.log('[verify-order-workflow-target] claimed vs confirmed are distinct: PASS');
}

/**
 * Verify payment remains independent from confirmation in target.
 */
function verifyPaymentIndependentFromConfirmation() {
  const claimedFixture = getFixture('claimed-unconfirmed');
  const confirmedFixture = getFixture('confirmed-ready-for-service');

  // Both fixtures must have paymentStatus=UNPAID
  assert.strictEqual(
    claimedFixture.fields.paymentStatus,
    0, // UNPAID
    'claimed-unconfirmed: paymentStatus must be UNPAID (0) - claim does not affect payment'
  );

  assert.strictEqual(
    confirmedFixture.fields.paymentStatus,
    0, // UNPAID
    'confirmed-ready-for-service: paymentStatus must be UNPAID (0) - confirmation does not affect payment'
  );

  // Target expectations confirm payment is not the gate
  const claimedTarget = getTargetExpectation('claimed-unconfirmed');
  const confirmedTarget = getTargetExpectation('confirmed-ready-for-service');

  assert.strictEqual(claimedTarget.canConfirmPayment, false, 'claimed: canConfirmPayment=false');
  assert.strictEqual(confirmedTarget.canConfirmPayment, false, 'confirmed: canConfirmPayment=false');

  console.log('[verify-order-workflow-target] payment independent from confirmation: PASS');
}

/**
 * Verify target allows claimed-unconfirmed -> confirmed-ready-for-service via updateOrderUserInfo.
 */
function verifyTargetAllowsConfirmationTransition() {
  const transitions = getTransitionsFrom('claimed-unconfirmed');

  const toConfirmedTransition = transitions.find(
    t => t.trigger === 'updateOrderUserInfo' && t.to === 'confirmed-ready-for-service'
  );

  assert.ok(
    toConfirmedTransition,
    'Transition claimed-unconfirmed -> confirmed-ready-for-service must exist in transition matrix'
  );

  assert.strictEqual(
    toConfirmedTransition.allowedInTarget,
    true,
    'Target MUST allow claimed-unconfirmed -> confirmed-ready-for-service via updateOrderUserInfo'
  );

  console.log('[verify-order-workflow-target] confirmation transition allowed: PASS');
}

/**
 * Verify target allows confirmed-ready-for-service -> processing via admin start service.
 */
function verifyTargetAllowsServiceStartFromConfirmed() {
  const allowed = isTransitionAllowedInTarget('confirmed-ready-for-service', 'adminStartService');

  assert.strictEqual(
    allowed,
    true,
    'Target MUST allow confirmed-ready-for-service -> processing via adminStartService'
  );

  console.log('[verify-order-workflow-target] service start from confirmed allowed: PASS');
}

/**
 * Verify target allows processing -> service-done-unpaid.
 */
function verifyTargetAllowsProcessingToServiceDone() {
  const allowed = isTransitionAllowedInTarget('processing', 'adminMarkServiceDone');

  assert.strictEqual(
    allowed,
    true,
    'Target MUST allow processing -> service-done-unpaid via adminMarkServiceDone'
  );

  console.log('[verify-order-workflow-target] processing -> service-done-unpaid allowed: PASS');
}

/**
 * Verify target allows service-done-unpaid -> completed.
 */
function verifyTargetAllowsServiceDoneToCompleted() {
  const allowed = isTransitionAllowedInTarget('service-done-unpaid', 'adminConfirmPayment');

  assert.strictEqual(
    allowed,
    true,
    'Target MUST allow service-done-unpaid -> completed via adminConfirmPayment'
  );

  console.log('[verify-order-workflow-target] service-done-unpaid -> completed allowed: PASS');
}

/**
 * Verify terminal states have no forward workflow actions in target.
 */
function verifyTerminalStatesTarget() {
  const completedTarget = getTargetExpectation('completed');
  const cancelledTarget = getTargetExpectation('cancelled');

  assert.strictEqual(completedTarget.isTerminal, true, 'completed: must be terminal');
  assert.strictEqual(completedTarget.hasForwardWorkflowAction, false, 'completed: no forward workflow');

  assert.strictEqual(cancelledTarget.isTerminal, true, 'cancelled: must be terminal');
  assert.strictEqual(cancelledTarget.hasForwardWorkflowAction, false, 'cancelled: no forward workflow');

  // Verify transitions from terminal states are disallowed
  const anyFromCompleted = isTransitionAllowedInTarget('completed', 'anyForwardWorkflow');
  const anyFromCancelled = isTransitionAllowedInTarget('cancelled', 'anyForwardWorkflow');

  assert.strictEqual(anyFromCompleted, false, 'completed: anyForwardWorkflow must be disallowed');
  assert.strictEqual(anyFromCancelled, false, 'cancelled: anyForwardWorkflow must be disallowed');

  console.log('[verify-order-workflow-target] terminal states: PASS');
}

/**
 * Verify bindOrder does NOT transition to confirmed in target.
 */
function verifyBindDoesNotConfirm() {
  const transitions = getTransitionsFrom('unclaimed-admin-created');

  const bindTransition = transitions.find(t => t.trigger === 'bindOrder');

  assert.ok(bindTransition, 'bindOrder transition must exist');

  // bindOrder must go to claimed-unconfirmed, NOT confirmed-ready-for-service
  assert.strictEqual(
    bindTransition.to,
    'claimed-unconfirmed',
    'Target: bindOrder MUST transition to claimed-unconfirmed (not confirmed)'
  );

  assert.strictEqual(
    bindTransition.allowedInTarget,
    true,
    'Target: bindOrder must be allowed'
  );

  console.log('[verify-order-workflow-target] bindOrder does not confirm: PASS');
}

// ============================================================================
// PHASE 1 SPECIFIC VERIFICATIONS
// ============================================================================

/**
 * Run Phase 1 confirmation milestone verifications.
 * Outputs the required markers: bindDoesNotConfirm, userConfirmTransitionsState, paymentIndependent
 */
function runPhase1Verifications() {
  console.log('[verify-order-workflow-target] Running Phase 1 confirmation milestone checks...');

  // Check 1: bindOrder does not confirm
  const transitionsFromUnclaimed = getTransitionsFrom('unclaimed-admin-created');
  const bindTransition = transitionsFromUnclaimed.find(t => t.trigger === 'bindOrder');
  assert.ok(bindTransition, 'Phase1: bindOrder transition must exist');
  assert.strictEqual(bindTransition.to, 'claimed-unconfirmed', 'Phase1: bindOrder must go to claimed-unconfirmed');
  const bindDoesNotConfirm = bindTransition.to !== 'confirmed-ready-for-service';

  // Check 2: userConfirmTransitionsState (updateOrderUserInfo transitions to confirmed-ready-for-service)
  const transitionsFromClaimed = getTransitionsFrom('claimed-unconfirmed');
  const confirmTransition = transitionsFromClaimed.find(
    t => t.trigger === 'updateOrderUserInfo' && t.to === 'confirmed-ready-for-service'
  );
  assert.ok(confirmTransition, 'Phase1: updateOrderUserInfo -> confirmed transition must exist');
  assert.strictEqual(confirmTransition.allowedInTarget, true, 'Phase1: confirmation transition must be allowed');
  const userConfirmTransitionsState = confirmTransition.allowedInTarget;

  // Check 3: paymentIndependent (paymentStatus unchanged through confirmation)
  const claimedFixture = getFixture('claimed-unconfirmed');
  const confirmedFixture = getFixture('confirmed-ready-for-service');
  const paymentIndependent =
    claimedFixture.fields.paymentStatus === confirmedFixture.fields.paymentStatus &&
    claimedFixture.fields.paymentStatus === 0; // UNPAID

  assert.strictEqual(paymentIndependent, true, 'Phase1: payment must be independent from confirmation');

  console.log('');
  console.log('[verify-order-workflow-target] ========================================');
  console.log('[verify-order-workflow-target] STATE=TARGET-SPECIFIED');
  console.log('[verify-order-workflow-target] --phase=phase1-confirmation-milestone');
  console.log(`[verify-order-workflow-target] bindDoesNotConfirm=${bindDoesNotConfirm}`);
  console.log(`[verify-order-workflow-target] userConfirmTransitionsState=${userConfirmTransitionsState}`);
  console.log(`[verify-order-workflow-target] paymentIndependent=${paymentIndependent}`);
  console.log('[verify-order-workflow-target] PASS');
  console.log('[verify-order-workflow-target] ========================================');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('[verify-order-workflow-target] Starting target invariant verification...');

  // Always run basic consistency checks first
  verifyCanonicalFixtureIds();
  verifyTransitionFixtureReferences();
  verifyTargetTransitionConsistency();

  // Phase-specific execution
  if (PHASE === 'phase1-confirmation-milestone') {
    // Run all target checks + phase1 specific markers
    verifyClaimedUnconfirmedDistinctFromConfirmed();
    verifyConfirmedReadyForServiceIsFirstClass();
    verifyClaimedAndConfirmedAreDistinctStates();
    verifyPaymentIndependentFromConfirmation();
    verifyTargetAllowsConfirmationTransition();
    verifyTargetAllowsServiceStartFromConfirmed();
    verifyBindDoesNotConfirm();
    verifyTerminalStatesTarget();

    // Output phase1 markers
    runPhase1Verifications();
  } else {
    // Default: run all target verifications
    verifyClaimedUnconfirmedDistinctFromConfirmed();
    verifyConfirmedReadyForServiceIsFirstClass();
    verifyClaimedAndConfirmedAreDistinctStates();
    verifyPaymentIndependentFromConfirmation();
    verifyTargetAllowsConfirmationTransition();
    verifyTargetAllowsServiceStartFromConfirmed();
    verifyTargetAllowsProcessingToServiceDone();
    verifyTargetAllowsServiceDoneToCompleted();
    verifyBindDoesNotConfirm();
    verifyTerminalStatesTarget();

    // All verifications passed
    console.log('');
    console.log('[verify-order-workflow-target] ========================================');
    console.log('[verify-order-workflow-target] STATE=TARGET-SPECIFIED');
    console.log('[verify-order-workflow-target] PASS');
    console.log('[verify-order-workflow-target] ========================================');
  }

  process.exit(0);
}

// Run main
main();
