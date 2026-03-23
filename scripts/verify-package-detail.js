#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const selectedCaseArg = process.argv.find((arg) => arg.startsWith('--case='));
const selectedCase = selectedCaseArg ? selectedCaseArg.split('=')[1] : '';

const detailJs = read('miniprogram/pages/package/detail/detail.js');
const detailWxml = read('miniprogram/pages/package/detail/detail.wxml');
const detailWxss = read('miniprogram/pages/package/detail/detail.wxss');

const checks = {
  'swipe-delete': {
    swipeDeleteMarkup:
      /class="product-swipe-wrapper"/.test(detailWxml) &&
      /class="product-delete-action"[\s\S]*?catchtap="onDeleteProduct"/.test(detailWxml) &&
      /bindtouchstart="onProductTouchStart"/.test(detailWxml) &&
      /bindtouchmove="onProductTouchMove"/.test(detailWxml) &&
      /bindtouchend="onProductTouchEnd"/.test(detailWxml) &&
      /translateX\(\{\{product\.swipeTranslateX \|\| 0\}\}rpx\)/.test(detailWxml)
  },
  'swipe-style': {
    swipeStyleContract:
      /\.product-swipe-wrapper\s*\{[\s\S]*?overflow:\s*hidden;/.test(detailWxss) &&
      /\.product-delete-action\s*\{[\s\S]*?width:\s*150rpx;/.test(detailWxss) &&
      /\.product-item\.touch-move\s*\{[\s\S]*?transition:\s*none;/.test(detailWxss)
  },
  'delete-confirm': {
    deleteConfirmContract:
      /onDeleteProduct\(e\)\s*\{[\s\S]*?wx\.showModal\(\{[\s\S]*?if \(!res\.confirm\) \{[\s\S]*?resetSwipeRow\([\s\S]*?return;[\s\S]*?\}[\s\S]*?splice\(safeProductIndex,\s*1\)[\s\S]*?syncItemsAndPrices\(updatedItems\)/.test(detailJs)
  },
  'single-open': {
    singleOpenContract:
      /swipeOpenRowKey/.test(detailJs) &&
      /closeOpenedSwipeRow\(excludeRowKey\s*=\s*''\)/.test(detailJs) &&
      /if \(!swipeOpenRowKey \|\| swipeOpenRowKey === excludeRowKey\)/.test(detailJs) &&
      /if \(shouldOpen\) \{[\s\S]*?updates\.swipeOpenRowKey = rowKey;/.test(detailJs)
  },
  'empty-slot': {
    emptySlotCtaContract:
      /empty-category-slot/.test(detailWxml) &&
      /bindtap="onSelectProductForEmpty"/.test(detailWxml) &&
      /onSelectProductForEmpty\(e\)\s*\{[\s\S]*?productIndex:\s*-1/.test(detailJs)
  },
  'compact-layout': {
    compactLayoutMarkup:
      /class="product-meta-row"/.test(detailWxml) &&
      /class="product-subtotal"/.test(detailWxml) &&
      /class="quantity-control inline"/.test(detailWxml) &&
      /class="product-price-stack inline"/.test(detailWxml) &&
      !/product-subtotal-row/.test(detailWxml) &&
      !/quantity-row/.test(detailWxml),
    compactStyleContract:
      /\.product-image\s*\{[\s\S]*?width:\s*48rpx;/.test(detailWxss) &&
      /\.product-meta-row\s*\{[\s\S]*?display:\s*flex;/.test(detailWxss) &&
      /\.product-price-stack\.inline\s*\{[\s\S]*?flex-direction:\s*row;/.test(detailWxss) &&
      /\.quantity-control\.inline\s*\{[\s\S]*?gap:\s*6rpx;/.test(detailWxss)
  },
  'quantity-tap-guard': {
    quantityTapMarkup:
      /class="quantity-control inline"[\s\S]*?catchtap="onQuantityTap"/.test(detailWxml) &&
      /bindtap="onQuantityChange"[\s\S]*?data-action="decrease"/.test(detailWxml) &&
      /bindtap="onQuantityChange"[\s\S]*?data-action="increase"/.test(detailWxml),
    quantityTapHandler:
      /onQuantityTap\(\)\s*\{[\s\S]*?prevent event propagation/.test(detailJs)
      || /onQuantityTap\(\)\s*\{[\s\S]*?Do nothing/.test(detailJs)
      || /onQuantityTap\(\)\s*\{[\s\S]*?\}/.test(detailJs),
    quantityBoundsLogic:
      /onQuantityChange\(e\)\s*\{[\s\S]*?action === 'decrease' && product\.quantity > 1/.test(detailJs)
  },
  'category-add-entry': {
    categoryAddMarkup:
      /class="category-add-slot"[\s\S]*?wx:if="\{\{category\.products\.length > 0\}\}"/.test(detailWxml) &&
      /class="category-add-btn"[\s\S]*?bindtap="onSelectProductForEmpty"/.test(detailWxml) &&
      /data-category-index="\{\{categoryIndex\}\}"[\s\S]*?data-category-id="\{\{category\.categoryId\}\}"/.test(detailWxml),
    categoryAddStyle:
      /\.category-add-slot\s*\{[\s\S]*?justify-content:\s*flex-end;/.test(detailWxss) &&
      /\.category-add-btn\s*\{[\s\S]*?border-radius:\s*22rpx;/.test(detailWxss),
    categoryAddLogic:
      /onSelectProductForEmpty\(e\)\s*\{[\s\S]*?productIndex:\s*-1/.test(detailJs)
  },
  'compact-action-alignment': {
    compactActionMarkup:
      /class="product-meta-row"[\s\S]*?class="product-meta-actions"/.test(detailWxml) &&
      /class="product-meta-actions"[\s\S]*?class="product-actions compact"/.test(detailWxml) &&
      /class="change-btn compact"/.test(detailWxml),
    compactActionStyle:
      /\.product-meta-actions\s*\{[\s\S]*?align-items:\s*center;/.test(detailWxss) &&
      /\.product-actions\s*\{[\s\S]*?flex-shrink:\s*0;/.test(detailWxss) &&
      /\.quantity-control\.inline\s*\{[\s\S]*?flex-shrink:\s*0;/.test(detailWxss) &&
      !/\.product-actions[\s\S]*?align-self:\s*flex-end;/.test(detailWxss) &&
      !/\.product-actions\.compact[\s\S]*?align-self:\s*flex-end;/.test(detailWxss)
  },
  'customized-layout-stability': {
    customizedMarkup:
      /class="item-card \{\{category\.isCustomized \? 'customized' : ''\}\}"/.test(detailWxml) &&
      !/customized-badge/.test(detailWxml),
    customizedStyle:
      /\.item-card\.customized\s*\.item-header\s*\{[\s\S]*?background:\s*linear-gradient/.test(detailWxss)
  },
  'confirm-replace-swipe-reset': {
    swipeResetLogic:
      /onConfirmReplace\(\)[\s\S]*?swipeTranslateX:\s*0[\s\S]*?swipeIsTouchMove:\s*false/.test(detailJs) &&
      /onConfirmReplace\(\)[\s\S]*?swipeOpenRowKey:\s*''[\s\S]*?swipeActiveRowKey:\s*''[\s\S]*?swipeStartTranslateX:\s*0/.test(detailJs)
  },
  'original-price-style': {
    noOriginalStrike:
      /\.summary-value\.original/.test(detailWxss)
      && !/\.summary-value\.original[\s\S]*?text-decoration\s*:\s*line-through/.test(detailWxss)
  },
  'reference-pricing': {
    referenceLabels:
      /参考总价/.test(detailWxml) && /参考合计/.test(detailWxml),
    noDiscountRow:
      !/summary-value\s+saved/.test(detailWxml) && !/优惠金额/.test(detailWxml),
    referencePricingLogic:
      /const totalPrice = itemsTotal;/.test(detailJs)
      && /const originalPrice = itemsTotal;/.test(detailJs)
      && /const savedAmount = 0;/.test(detailJs)
  },
  fallback: {
    loadProductsFailFallback: /catch \(err\) \{[\s\S]*?availableProducts:\s*\[\][\s\S]*?loadingProducts:\s*false[\s\S]*?加载商品失败/.test(detailJs),
    invalidParamFallback: /参数错误/.test(detailJs) && /wx\.navigateBack\(\)/.test(detailJs),
    noMinusToZeroDelete: /else if \(action === 'decrease' && product\.quantity > 1\)/.test(detailJs)
  }
};

const caseAliases = {
  compact: 'compact-layout',
  'original-price': 'original-price-style'
};

const normalizedCase = caseAliases[selectedCase] || selectedCase;

if (normalizedCase && !checks[normalizedCase]) {
  console.error(`[verify-package-detail] FAIL: 未知 case=${selectedCase}`);
  process.exit(1);
}

const casesToRun = normalizedCase
  ? [normalizedCase]
  : [
    'swipe-delete',
    'swipe-style',
    'delete-confirm',
    'single-open',
    'empty-slot',
    'compact-layout',
    'quantity-tap-guard',
    'category-add-entry',
    'compact-action-alignment',
    'customized-layout-stability',
    'confirm-replace-swipe-reset',
    'original-price-style',
    'reference-pricing',
    'fallback'
  ];

let allPassed = true;

for (const caseName of casesToRun) {
  const resultMap = checks[caseName];
  const passed = Object.values(resultMap).every(Boolean);
  allPassed = allPassed && passed;

  console.log(`[verify-package-detail] CASE=${caseName} PASS=${passed}`);
  Object.entries(resultMap).forEach(([name, value]) => {
    console.log(`- ${caseName}.${name}: ${value}`);
  });
}

const state = allPassed ? 'TARGET' : 'ERROR';
console.log(`[verify-package-detail] STATE=${state}`);

if (!allPassed) {
  console.error('[verify-package-detail] FAIL: 套餐详情契约未同时覆盖 TARGET 与 FALLBACK 路径。');
  process.exit(1);
}

console.log('[verify-package-detail] PASS (TARGET)');
process.exit(0);
