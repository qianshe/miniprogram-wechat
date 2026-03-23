'use strict';

const fs = require('fs');
const path = require('path');
const {
  ORDER_FLOW_STATUS,
  WORKFLOW_MILESTONE,
  getWorkflowMilestone,
  mapLegacyStatusToNew
} = require('../miniprogram/config/constants.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    phase: null,
    input: '.sisyphus/evidence/phase5-active-order-source.json',
    output: '.sisyphus/evidence/phase5-active-order-inventory.json'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--phase=')) result.phase = arg.slice('--phase='.length);
    else if (arg === '--phase') result.phase = args[i + 1];
    else if (arg.startsWith('--input=')) result.input = arg.slice('--input='.length);
    else if (arg === '--input') result.input = args[i + 1];
    else if (arg.startsWith('--output=')) result.output = arg.slice('--output='.length);
    else if (arg === '--output') result.output = args[i + 1];
  }

  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeStatuses(record) {
  if (record.orderStatus !== undefined && record.orderStatus !== null) {
    return {
      orderStatus: Number(record.orderStatus),
      paymentStatus: Number(record.paymentStatus)
    };
  }
  return mapLegacyStatusToNew(record.status, record.payTime);
}

function deriveLegacyDependency(record) {
  const hasNewFields = record.orderStatus !== undefined && record.orderStatus !== null && record.paymentStatus !== undefined && record.paymentStatus !== null;
  return !hasNewFields;
}

function isActiveRecord(orderStatus) {
  return orderStatus !== ORDER_FLOW_STATUS.COMPLETED && orderStatus !== ORDER_FLOW_STATUS.CANCELLED;
}

function classifyRecord(record) {
  const { orderStatus, paymentStatus } = normalizeStatuses(record);
  const workflowMilestone = getWorkflowMilestone({
    ...record,
    orderStatus,
    paymentStatus
  });

  return {
    orderStatus,
    paymentStatus,
    workflowMilestone,
    dependsOnRawLegacyStatusBranching: deriveLegacyDependency(record),
    isActive: isActiveRecord(orderStatus)
  };
}

function buildInventory(source) {
  const records = Array.isArray(source.records) ? source.records : [];
  const analyzed = records.map((record) => {
    const classification = classifyRecord(record);
    return {
      ...record,
      ...classification
    };
  });

  const activeRecords = analyzed.filter((record) => record.isActive);
  const grouped = new Map();

  activeRecords.forEach((record) => {
    const key = record.workflowMilestone || 'unknown';
    if (!grouped.has(key)) {
      grouped.set(key, {
        recordClass: key,
        count: 0,
        dependsOnRawLegacyStatusBranching: false,
        sampleOrderNos: []
      });
    }

    const bucket = grouped.get(key);
    bucket.count += 1;
    bucket.dependsOnRawLegacyStatusBranching = bucket.dependsOnRawLegacyStatusBranching || record.dependsOnRawLegacyStatusBranching;
    if (bucket.sampleOrderNos.length < 5) {
      bucket.sampleOrderNos.push(record.orderNo || record._id || 'unknown');
    }
  });

  return {
    phase: 'phase5-readiness',
    capturedAt: new Date().toISOString(),
    source: {
      envId: source.envId || '',
      sourceLabel: source.source || 'unknown',
      inputPath: source.__inputPath || ''
    },
    scannedActiveRecordCount: activeRecords.length,
    scannedRecordCount: analyzed.length,
    rows: Array.from(grouped.values()),
    summary: {
      activeLegacyDependencyCount: activeRecords.filter((record) => record.dependsOnRawLegacyStatusBranching).length,
      cleanupReady: activeRecords.every((record) => !record.dependsOnRawLegacyStatusBranching)
    }
  };
}

function main() {
  const { phase, input, output } = parseArgs();
  if (phase && phase !== 'phase5-readiness') {
    throw new Error(`Unsupported phase: ${phase}`);
  }

  const source = readJson(input);
  source.__inputPath = input;
  const artifact = buildInventory(source);
  ensureDir(output);
  fs.writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(`ACTIVE_ORDER_INVENTORY_WRITTEN=${output}`);
}

main();
