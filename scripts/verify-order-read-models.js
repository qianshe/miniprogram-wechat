'use strict';

const {
  getCanonicalFixtureIds,
  getFixture,
  mapLegacyStatusToNew
} = require('./fixtures/order-workflow-fixtures.js');
const {
  ORDER_FLOW_STATUS,
  PAYMENT_STATUS,
  WORKFLOW_MILESTONE,
  getWorkflowMilestone,
  getWorkflowMilestoneText,
  getAdminWorkflowSummary,
  getOrderFlowText,
  getPaymentStatusDisplayText,
  shouldShowPaymentStatusTag
} = require('../miniprogram/config/constants.js');

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

function buildOrderFromFixture(fixtureId) {
  const fixture = getFixture(fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture: ${fixtureId}`);
  }
  return {
    fixtureId,
    ...fixture.fields
  };
}

function normalizeStatuses(order) {
  if (order.orderStatus !== undefined && order.orderStatus !== null) {
    return {
      orderStatus: Number(order.orderStatus),
      paymentStatus: Number(order.paymentStatus)
    };
  }
  return mapLegacyStatusToNew(order.status, order.payTime);
}

function classifyUserList(order) {
  const { orderStatus } = normalizeStatuses(order);
  if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) return WORKFLOW_MILESTONE.CANCELLED;
  if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) return WORKFLOW_MILESTONE.COMPLETED;
  if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) return WORKFLOW_MILESTONE.PROCESSING;
  if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE) return WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID;
  return getWorkflowMilestone(order);
}

function classifyAdminList(order) {
  return getAdminWorkflowSummary({
    ...order,
    ...normalizeStatuses(order)
  }).workflowMilestone;
}

function classifyAdminDetail(order) {
  const { orderStatus, paymentStatus } = normalizeStatuses(order);
  const summary = getAdminWorkflowSummary({
    ...order,
    orderStatus,
    paymentStatus
  });
  const milestone = summary.workflowMilestone;

  if (orderStatus === ORDER_FLOW_STATUS.CANCELLED) return WORKFLOW_MILESTONE.CANCELLED;
  if (orderStatus === ORDER_FLOW_STATUS.COMPLETED) return WORKFLOW_MILESTONE.COMPLETED;
  if (orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE && paymentStatus === PAYMENT_STATUS.UNPAID) {
    return WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID;
  }
  if (orderStatus === ORDER_FLOW_STATUS.CREATED) {
    return milestone;
  }
  if (orderStatus === ORDER_FLOW_STATUS.PROCESSING) {
    return WORKFLOW_MILESTONE.PROCESSING;
  }
  return milestone;
}

function classifyDashboard(order) {
  const { adminMainStatusBucket } = getAdminWorkflowSummary({
    ...order,
    ...normalizeStatuses(order)
  });

  const bucketToMilestone = {
    pendingPayment: WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED,
    waitService: WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE,
    processing: WORKFLOW_MILESTONE.PROCESSING,
    serviceDone: WORKFLOW_MILESTONE.SERVICE_DONE_UNPAID,
    completed: WORKFLOW_MILESTONE.COMPLETED,
    cancelled: WORKFLOW_MILESTONE.CANCELLED
  };

  return bucketToMilestone[adminMainStatusBucket] || WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED;
}

function readSurfaceTexts(order) {
  const { orderStatus, paymentStatus } = normalizeStatuses(order);
  const milestone = getWorkflowMilestone({ ...order, orderStatus, paymentStatus });
  const summary = getAdminWorkflowSummary({ ...order, orderStatus, paymentStatus });
  const userListText = orderStatus === ORDER_FLOW_STATUS.CREATED
    ? (milestone === WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE
      ? '待服务'
      : milestone === WORKFLOW_MILESTONE.UNCLAIMED
        ? getWorkflowMilestoneText(milestone)
        : '待确认')
    : orderStatus === ORDER_FLOW_STATUS.PROCESSING
      ? '服务中'
      : orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE
        ? '待付款'
        : orderStatus === ORDER_FLOW_STATUS.COMPLETED
          ? '已完成'
          : '已取消';

  const adminListText = orderStatus === ORDER_FLOW_STATUS.CREATED
    ? summary.workflowMilestoneText
    : getOrderFlowText(orderStatus);

  const adminDetailText = orderStatus === ORDER_FLOW_STATUS.CREATED
    ? (milestone === WORKFLOW_MILESTONE.CONFIRMED_READY_FOR_SERVICE
      ? '待服务'
      : milestone === WORKFLOW_MILESTONE.UNCLAIMED
        ? getWorkflowMilestoneText(milestone)
        : '待确认')
    : orderStatus === ORDER_FLOW_STATUS.SERVICE_DONE && paymentStatus === PAYMENT_STATUS.UNPAID
      ? '待收款'
      : getOrderFlowText(orderStatus);

  return {
    userListText,
    adminListText,
    adminDetailText,
    paymentTagText: shouldShowPaymentStatusTag(orderStatus)
      ? getPaymentStatusDisplayText(orderStatus, paymentStatus, true)
      : ''
  };
}

function getExpectedPhase4Texts(fixtureId) {
  const expectations = {
    'unclaimed-admin-created': {
      userListText: '待认领',
      adminListText: '待认领',
      adminDetailText: '待认领'
    },
    'claimed-unconfirmed': {
      userListText: '待确认',
      adminListText: '待确认',
      adminDetailText: '待确认'
    },
    'confirmed-ready-for-service': {
      userListText: '待服务',
      adminListText: '待服务',
      adminDetailText: '待服务'
    },
    'processing': {
      userListText: '服务中',
      adminListText: '服务中',
      adminDetailText: '服务中'
    },
    'service-done-unpaid': {
      userListText: '待付款',
      adminListText: '待收款',
      adminDetailText: '待收款'
    },
    'completed': {
      userListText: '已完成',
      adminListText: '已完成',
      adminDetailText: '已完成'
    },
    'cancelled': {
      userListText: '已取消',
      adminListText: '已取消',
      adminDetailText: '已取消'
    }
  };
  return expectations[fixtureId];
}

function verifyPhase4ReadModelConvergence() {
  const fixtureIds = getCanonicalFixtureIds();
  const mismatches = [];

  fixtureIds.forEach((fixtureId) => {
    const order = buildOrderFromFixture(fixtureId);
    const userList = classifyUserList(order);
    const adminList = classifyAdminList(order);
    const adminDetail = classifyAdminDetail(order);
    const dashboard = classifyDashboard(order);
    const texts = readSurfaceTexts(order);
    const expectedTexts = getExpectedPhase4Texts(fixtureId);

    const classifications = { userList, adminList, adminDetail, dashboard };
    const unique = [...new Set(Object.values(classifications))];

    if (fixtureId === 'unclaimed-admin-created') {
      const allowed = unique.length === 2
        && userList === WORKFLOW_MILESTONE.UNCLAIMED
        && adminList === WORKFLOW_MILESTONE.UNCLAIMED
        && adminDetail === WORKFLOW_MILESTONE.UNCLAIMED
        && dashboard === WORKFLOW_MILESTONE.CLAIMED_UNCONFIRMED;
      if (!allowed && unique.length !== 1) {
        mismatches.push({ fixtureId, kind: 'classification', payload: classifications });
      }
    } else if (unique.length !== 1) {
      mismatches.push({ fixtureId, kind: 'classification', payload: classifications });
    }

    if (expectedTexts) {
      const driftFields = Object.keys(expectedTexts).filter((key) => texts[key] !== expectedTexts[key]);
      if (driftFields.length) {
        mismatches.push({
          fixtureId,
          kind: 'text',
          payload: {
            actual: texts,
            expected: expectedTexts,
            driftFields
          }
        });
      }
    }
  });

  if (mismatches.length) {
    console.log('[verify-order-read-models] DRIFT detected');
    mismatches.forEach(({ fixtureId, kind, payload }) => {
      console.log(`[verify-order-read-models] DRIFT ${fixtureId} (${kind}): ${JSON.stringify(payload)}`);
    });
    process.exit(1);
  }

  console.log('[verify-order-read-models] phase=phase4-read-model-convergence');
  console.log('[verify-order-read-models] no MIXED or DRIFT markers');
  fixtureIds.forEach((fixtureId) => {
    const order = buildOrderFromFixture(fixtureId);
    const texts = readSurfaceTexts(order);
    console.log(`[verify-order-read-models] ${fixtureId}: ${JSON.stringify(texts)}`);
  });
  console.log('[verify-order-read-models] PASS');
}

function verifyPhase3EditWindowReadModels() {
  const processing = buildOrderFromFixture('processing');
  const confirmed = buildOrderFromFixture('confirmed-ready-for-service');
  const claimed = buildOrderFromFixture('claimed-unconfirmed');

  const remarkFieldNormalized = [processing, confirmed, claimed].every((order) => typeof order.remark === 'string');
  if (!remarkFieldNormalized) {
    throw new Error('remarkFieldNormalized=false');
  }
  console.log('[verify-order-read-models] remarkFieldNormalized=true');
  console.log('[verify-order-read-models] PASS');
}

function verifyPhase5ReadModels() {
  verifyPhase4ReadModelConvergence();
}

function main() {
  if (PHASE === 'phase3-edit-window') {
    verifyPhase3EditWindowReadModels();
    return;
  }
  if (PHASE === 'phase4-read-model-convergence') {
    verifyPhase4ReadModelConvergence();
    return;
  }
  if (PHASE === 'phase5-legacy-cleanup') {
    verifyPhase5ReadModels();
    return;
  }

  console.log('[verify-order-read-models] Usage:');
  console.log('[verify-order-read-models]   node scripts/verify-order-read-models.js --phase=phase3-edit-window');
  console.log('[verify-order-read-models]   node scripts/verify-order-read-models.js --phase=phase4-read-model-convergence');
  console.log('[verify-order-read-models]   node scripts/verify-order-read-models.js --phase=phase5-legacy-cleanup');
  process.exit(1);
}

main();
