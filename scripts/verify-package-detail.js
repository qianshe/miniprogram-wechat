#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const detailJs = read('pages/package/detail/detail.js');
const detailWxml = read('pages/package/detail/detail.wxml');
const detailWxss = read('pages/package/detail/detail.wxss');

// TARGET path: swipe-delete + confirm + single-open interaction model.
const target = {
  swipeDeleteMarkup:
    /class="product-swipe-wrapper"/.test(detailWxml) &&
    /class="product-delete-action"[\s\S]*?catchtap="onDeleteProduct"/.test(detailWxml) &&
    /bindtouchstart="onProductTouchStart"/.test(detailWxml) &&
    /bindtouchmove="onProductTouchMove"/.test(detailWxml) &&
    /bindtouchend="onProductTouchEnd"/.test(detailWxml) &&
    /translateX\(\{\{product\.swipeTranslateX \|\| 0\}\}rpx\)/.test(detailWxml),

  swipeStyleContract:
    /\.product-swipe-wrapper\s*\{[\s\S]*?overflow:\s*hidden;/.test(detailWxss) &&
    /\.product-delete-action\s*\{[\s\S]*?width:\s*150rpx;/.test(detailWxss) &&
    /\.product-item\.touch-move\s*\{[\s\S]*?transition:\s*none;/.test(detailWxss),

  deleteConfirmContract:
    /onDeleteProduct\(e\)\s*\{[\s\S]*?wx\.showModal\(\{[\s\S]*?if \(!res\.confirm\) \{[\s\S]*?resetSwipeRow\([\s\S]*?return;[\s\S]*?\}[\s\S]*?splice\(safeProductIndex,\s*1\)[\s\S]*?syncItemsAndPrices\(updatedItems\)/.test(detailJs),

  singleOpenContract:
    /swipeOpenRowKey/.test(detailJs) &&
    /closeOpenedSwipeRow\(excludeRowKey\s*=\s*''\)/.test(detailJs) &&
    /if \(!swipeOpenRowKey \|\| swipeOpenRowKey === excludeRowKey\)/.test(detailJs) &&
    /if \(shouldOpen\) \{[\s\S]*?updates\.swipeOpenRowKey = rowKey;/.test(detailJs),

  emptySlotCtaContract:
    /empty-category-slot/.test(detailWxml) &&
    /bindtap="onSelectProductForEmpty"/.test(detailWxml) &&
    /onSelectProductForEmpty\(e\)\s*\{[\s\S]*?productIndex:\s*-1/.test(detailJs),

  compactLayoutMarkup:
    /class="product-meta-row"/.test(detailWxml) &&
    /class="product-subtotal"/.test(detailWxml) &&
    /class="quantity-control inline"/.test(detailWxml) &&
    !/product-subtotal-row/.test(detailWxml) &&
    !/quantity-row/.test(detailWxml),

  compactStyleContract:
    /\.product-image\s*\{[\s\S]*?width:\s*80rpx;/.test(detailWxss) &&
    /\.product-meta-row\s*\{[\s\S]*?display:\s*flex;/.test(detailWxss) &&
    /\.quantity-control\.inline\s*\{[\s\S]*?gap:\s*10rpx;/.test(detailWxss),

  noOriginalStrike:
    !/\.summary-value\.original[\s\S]*?text-decoration\s*:\s*line-through/.test(detailWxss)
};

// ERROR/FALLBACK path: load failure + invalid params and no minus-to-zero delete behavior.
const fallback = {
  loadProductsFailFallback: /catch \(err\) \{[\s\S]*?availableProducts:\s*\[\][\s\S]*?loadingProducts:\s*false[\s\S]*?加载商品失败/.test(detailJs),
  invalidParamFallback: /参数错误/.test(detailJs) && /wx\.navigateBack\(\)/.test(detailJs),
  noMinusToZeroDelete: /else if \(action === 'decrease' && product\.quantity > 1\)/.test(detailJs)
};

const allTarget = Object.values(target).every(Boolean);
const allFallback = Object.values(fallback).every(Boolean);
const ok = allTarget && allFallback;
const state = ok ? 'TARGET' : 'ERROR';

console.log(`[verify-package-detail] STATE=${state}`);
console.log(`- TARGET swipe-delete markup: ${target.swipeDeleteMarkup}`);
console.log(`- TARGET swipe style contract: ${target.swipeStyleContract}`);
console.log(`- TARGET delete confirm contract: ${target.deleteConfirmContract}`);
console.log(`- TARGET single-open swipe contract: ${target.singleOpenContract}`);
console.log(`- TARGET empty-slot CTA contract: ${target.emptySlotCtaContract}`);
console.log(`- TARGET compact layout markup: ${target.compactLayoutMarkup}`);
console.log(`- TARGET compact style contract: ${target.compactStyleContract}`);
console.log(`- TARGET no original price strike-through: ${target.noOriginalStrike}`);
console.log(`- FALLBACK product-load failure path: ${fallback.loadProductsFailFallback}`);
console.log(`- FALLBACK invalid-param navigateBack path: ${fallback.invalidParamFallback}`);
console.log(`- FALLBACK no minus-to-zero delete path: ${fallback.noMinusToZeroDelete}`);

if (!ok) {
  console.error('[verify-package-detail] FAIL: 套餐详情契约未同时覆盖 TARGET 与 FALLBACK 路径。');
  process.exit(1);
}

console.log('[verify-package-detail] PASS (TARGET)');
process.exit(0);
