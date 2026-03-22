'use strict';

const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    phase: null,
    input: '.sisyphus/evidence/phase5-active-order-inventory.json'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--phase=')) result.phase = arg.slice('--phase='.length);
    else if (arg === '--phase') result.phase = args[i + 1];
    else if (arg.startsWith('--input=')) result.input = arg.slice('--input='.length);
    else if (arg === '--input') result.input = args[i + 1];
  }

  return result;
}

function main() {
  const { phase, input } = parseArgs();
  if (phase && phase !== 'phase5-readiness') {
    throw new Error(`Unsupported phase: ${phase}`);
  }

  const artifact = JSON.parse(fs.readFileSync(input, 'utf8'));

  if (artifact.phase !== 'phase5-readiness') {
    throw new Error(`Unexpected phase: ${artifact.phase}`);
  }
  if (!artifact.source || typeof artifact.source !== 'object') {
    throw new Error('Missing source metadata');
  }
  if (!Array.isArray(artifact.rows)) {
    throw new Error('Missing rows array');
  }
  if (typeof artifact.scannedActiveRecordCount !== 'number') {
    throw new Error('Missing scannedActiveRecordCount');
  }
  if (!artifact.summary || typeof artifact.summary !== 'object') {
    throw new Error('Missing summary');
  }

  artifact.rows.forEach((row, index) => {
    if (!row.recordClass || typeof row.recordClass !== 'string') {
      throw new Error(`rows[${index}].recordClass invalid`);
    }
    if (typeof row.count !== 'number') {
      throw new Error(`rows[${index}].count invalid`);
    }
    if (typeof row.dependsOnRawLegacyStatusBranching !== 'boolean') {
      throw new Error(`rows[${index}].dependsOnRawLegacyStatusBranching invalid`);
    }
    if (!Array.isArray(row.sampleOrderNos)) {
      throw new Error(`rows[${index}].sampleOrderNos invalid`);
    }
  });

  const derivedLegacyDependencyCount = artifact.rows
    .filter((row) => row.dependsOnRawLegacyStatusBranching)
    .reduce((sum, row) => sum + row.count, 0);

  if (artifact.summary.activeLegacyDependencyCount !== derivedLegacyDependencyCount) {
    throw new Error('activeLegacyDependencyCount does not match rows');
  }

  const expectedReady = derivedLegacyDependencyCount === 0;
  if (artifact.summary.cleanupReady !== expectedReady) {
    throw new Error('cleanupReady does not match row dependency state');
  }

  if (!artifact.summary.cleanupReady) {
    console.log('ACTIVE_ORDER_INVENTORY_READY=false');
    console.log(JSON.stringify({
      activeLegacyDependencyCount: artifact.summary.activeLegacyDependencyCount,
      rows: artifact.rows
    }));
    process.exit(1);
  }

  console.log('ACTIVE_ORDER_INVENTORY_READY=true');
  console.log(`ACTIVE_ORDER_INVENTORY_ROWS=${artifact.rows.length}`);
  console.log(`ACTIVE_ORDER_INVENTORY_ACTIVE_COUNT=${artifact.scannedActiveRecordCount}`);
}

main();
