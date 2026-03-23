#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const files = [
  'miniprogram/pages/admin/index/index.wxml',
  'miniprogram/pages/admin/order/list/list.wxml',
  'miniprogram/config/constants.js'
];

const baselineLabel = '待付款';
const targetLabel = '待沟通';
const contents = files.map((f) => ({ file: f, text: read(f) }));

// Check WXML files for any occurrence
const wxmlFiles = contents.filter(({ file }) => file.endsWith('.wxml'));
const baselineWxmlHits = wxmlFiles.filter(({ text }) => text.includes(baselineLabel)).length;
const targetWxmlHits = wxmlFiles.filter(({ text }) => text.includes(targetLabel)).length;

// Check constants.js for ADMIN_ORDER_TABS only (not user-side labels)
const constants = contents.find((x) => x.file === 'miniprogram/config/constants.js').text;
const hasBaselineTab = /name:\s*'待付款'/.test(constants);
const hasTargetTab = /name:\s*'待沟通'/.test(constants);

const baselineDetected = baselineWxmlHits === wxmlFiles.length && hasBaselineTab && !hasTargetTab;
const targetDetected = targetWxmlHits === wxmlFiles.length && hasTargetTab && !hasBaselineTab;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-admin-copy] STATE=${state}`);
console.log(`- WXML baselineLabel(${baselineLabel}) hits: ${baselineWxmlHits}/${wxmlFiles.length}`);
console.log(`- WXML targetLabel(${targetLabel}) hits: ${targetWxmlHits}/${wxmlFiles.length}`);
console.log(`- constants baseline tab: ${hasBaselineTab}, target tab: ${hasTargetTab}`);

if (!ok) {
  console.error('[verify-admin-copy] FAIL: admin 状态文案处于混合态，无法判定为基线或目标态。');
  process.exit(1);
}

console.log(`[verify-admin-copy] PASS (${state})`);
process.exit(0);
