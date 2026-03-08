#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const detailJs = read('pages/package/detail/detail.js');
const detailWxml = read('pages/package/detail/detail.wxml');

const hasPriceDiffFormula = /const\s+totalPrice\s*=\s*baseDiscountPrice\s*\+\s*priceDiff/.test(detailJs);
const hasDirectReplaceAssign = /category\.products\[currentProductIndex\]\s*=/.test(detailJs);
const hasDeleteHandler = /on(Delete|Remove)(Product|Item)|removeProduct|deleteProduct/.test(detailJs);
const hasDeleteButton = /bindtap="on(Delete|Remove)/.test(detailWxml);
const hasDedupGuard = /isDuplicate|dedup|filter\([^\n]*productId|some\([^\n]*productId/.test(detailJs);

const baselineDetected = hasPriceDiffFormula && hasDirectReplaceAssign && !hasDeleteHandler && !hasDeleteButton && !hasDedupGuard;
const targetDetected = !hasPriceDiffFormula && (hasDeleteHandler || hasDeleteButton) && hasDedupGuard;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-package-detail] STATE=${state}`);
console.log(`- price formula uses baseDiscountPrice + priceDiff: ${hasPriceDiffFormula}`);
console.log(`- replacement direct index assignment: ${hasDirectReplaceAssign}`);
console.log(`- delete handler present: ${hasDeleteHandler}`);
console.log(`- delete UI present: ${hasDeleteButton}`);
console.log(`- dedup guard present: ${hasDedupGuard}`);

if (!ok) {
  console.error('[verify-package-detail] FAIL: 套餐详情逻辑处于混合态，无法归类为基线或目标态。');
  process.exit(1);
}

console.log(`[verify-package-detail] PASS (${state})`);
process.exit(0);
