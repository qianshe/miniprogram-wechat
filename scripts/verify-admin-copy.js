#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const files = [
  'pages/admin/index/index.wxml',
  'pages/admin/order/list/list.wxml',
  'config/constants.js'
];

const baselineLabel = '待付款';
const targetLabel = '待沟通';
const contents = files.map((f) => ({ file: f, text: read(f) }));

const baselineHits = contents.filter(({ text }) => text.includes(baselineLabel)).map(({ file }) => file);
const targetHits = contents.filter(({ text }) => text.includes(targetLabel)).map(({ file }) => file);

const constants = contents.find((x) => x.file === 'config/constants.js').text;
const hasBaselineTab = /name:\s*'待付款'/.test(constants);
const hasTargetTab = /name:\s*'待沟通'/.test(constants);

const baselineDetected = baselineHits.length === files.length && hasBaselineTab && !hasTargetTab;
const targetDetected = targetHits.length >= 2 && hasTargetTab && baselineHits.length === 0;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-admin-copy] STATE=${state}`);
console.log(`- baselineLabel(${baselineLabel}) hits: ${baselineHits.length}/${files.length}`);
console.log(`- targetLabel(${targetLabel}) hits: ${targetHits.length}/${files.length}`);
console.log(`- constants baseline tab: ${hasBaselineTab}, target tab: ${hasTargetTab}`);

if (!ok) {
  console.error('[verify-admin-copy] FAIL: admin 状态文案处于混合态，无法判定为基线或目标态。');
  process.exit(1);
}

console.log(`[verify-admin-copy] PASS (${state})`);
process.exit(0);
