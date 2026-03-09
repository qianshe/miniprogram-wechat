#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const wxml = read('pages/index_home/index_home.wxml');
const wxss = read('pages/index_home/index_home.wxss');
const logoBlock = (wxss.match(/\.logo-img\s*{[\s\S]*?}/) || [''])[0];
const doorBlock = (wxss.match(/\.door\s*{[\s\S]*?}/) || [''])[0];

const hasOriginalSplitDoorMarkup = /door\s+door-left/.test(wxml)
  && /door\s+door-right/.test(wxml)
  && /mode="widthFix"/.test(wxml);
const hasDoubleImage = (wxml.match(/class="logo-img"/g) || []).length >= 2;
const hasOriginalDoorStyle = /position:\s*absolute/.test(doorBlock)
  && /width:\s*50%/.test(doorBlock)
  && /height:\s*100%/.test(doorBlock)
  && /overflow:\s*hidden/.test(doorBlock);
const hasOriginalImageSplitStyle = /top:\s*\d+%/.test(logoBlock)
  && /width:\s*200%/.test(logoBlock)
  && /translateY\(-50%\)/.test(logoBlock)
  && /\.door-left\s+\.logo-img\s*{[\s\S]*left:\s*0/.test(wxss)
  && /\.door-right\s+\.logo-img\s*{[\s\S]*left:\s*-100%/.test(wxss);
const hasOpenAnimations = /\.door-left\.open\s*{[\s\S]*translateX\(-100%\)/.test(wxss)
  && /\.door-right\.open\s*{[\s\S]*translateX\(100%\)/.test(wxss);

const targetDetected = hasOriginalSplitDoorMarkup
  && hasDoubleImage
  && hasOriginalDoorStyle
  && hasOriginalImageSplitStyle
  && hasOpenAnimations;
const ok = targetDetected;
const state = targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-index-home-layout] STATE=${state}`);
console.log(`- original split-door markup: ${hasOriginalSplitDoorMarkup}`);
console.log(`- double logo images: ${hasDoubleImage}`);
console.log(`- original door style tokens: ${hasOriginalDoorStyle}`);
console.log(`- original image split tokens: ${hasOriginalImageSplitStyle}`);
console.log(`- open animation tokens: ${hasOpenAnimations}`);

if (!ok) {
  console.error('[verify-index-home-layout] FAIL: 启动页尚未达到“原始门体结构下从中线分开”的目标态。');
  process.exit(1);
}

console.log(`[verify-index-home-layout] PASS (${state})`);
process.exit(0);
