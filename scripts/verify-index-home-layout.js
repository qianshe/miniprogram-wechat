#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const wxml = read('pages/index_home/index_home.wxml');
const wxss = read('pages/index_home/index_home.wxss');

const hasSplitDoorMarkup = /door-left/.test(wxml) && /door-right/.test(wxml);
const hasDoubleImage = (wxml.match(/class="logo-img"/g) || []).length >= 2;
const hasSplitDoorStyle = /\.logo-img\s*{[\s\S]*width:\s*200%/.test(wxss) && /\.door-right\s+\.logo-img\s*{[\s\S]*left:\s*-100%/.test(wxss);
const hasCenteredLayoutHint = /justify-content:\s*center/.test(wxss) && /align-items:\s*center/.test(wxss);

const baselineDetected = hasSplitDoorMarkup && hasDoubleImage && hasSplitDoorStyle;
const targetDetected = !hasSplitDoorMarkup && hasCenteredLayoutHint;
const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-index-home-layout] STATE=${state}`);
console.log(`- split-door markup: ${hasSplitDoorMarkup}`);
console.log(`- double logo images: ${hasDoubleImage}`);
console.log(`- split-door style tokens: ${hasSplitDoorStyle}`);
console.log(`- centered layout hint: ${hasCenteredLayoutHint}`);

if (!ok) {
  console.error('[verify-index-home-layout] FAIL: 启动页布局处于混合态。');
  process.exit(1);
}

console.log(`[verify-index-home-layout] PASS (${state})`);
process.exit(0);
