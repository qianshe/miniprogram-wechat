#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const targetFiles = [
  'pages/index/index.wxml',
  'pages/index/index.js',
  'pages/goods/detail/detail.wxml',
  'pages/goods/detail/detail.js',
  'pages/package/list/list.wxml',
  'pages/package/detail/detail.wxml',
  'pages/package/detail/detail.js',
  'pages/package/confirm/confirm.wxml',
  'pages/package/confirm/confirm.js',
  'pages/user/user.wxml',
  'pages/user/user.js',
  'pages/order/list/list.wxml',
  'pages/order/detail/detail.wxml',
  'pages/order/detail/detail.js',
  'pages/order/confirm/confirm.wxml',
  'pages/order/confirm/confirm.js',
  'pages/order/user-confirm/user-confirm.wxml',
  'pages/order/user-confirm/user-confirm.js',
  'pages/scan-result/scan-result.wxml',
  'pages/scan-result/scan-result.js'
];

const forbiddenTerms = [
  '购物车',
  '确认下单',
  '提交订单',
  '在线支付',
  '立即支付',
  '去支付',
  '支付成功',
  '结账'
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function extractWxmlText(text) {
  return text;
}

function extractJsonText(text) {
  try {
    const json = JSON.parse(text);
    return JSON.stringify(json);
  } catch (error) {
    return text;
  }
}

function extractJsUiStrings(text) {
  const patterns = [
    /title\s*:\s*['"]([^'"]+)['"]/g,
    /content\s*:\s*['"]([^'"]+)['"]/g,
    /confirmText\s*:\s*['"]([^'"]+)['"]/g,
    /cancelText\s*:\s*['"]([^'"]+)['"]/g,
    /placeholder\s*:\s*['"]([^'"]+)['"]/g,
    /label\s*:\s*['"]([^'"]+)['"]/g,
    /desc\s*:\s*['"]([^'"]+)['"]/g,
    /itemList\s*:\s*\[([\s\S]*?)\]/g,
    /showToast\([\s\S]*?title\s*:\s*['"]([^'"]+)['"]/g,
    /showModal\([\s\S]*?title\s*:\s*['"]([^'"]+)['"]/g,
    /showModal\([\s\S]*?content\s*:\s*['"]([^'"]+)['"]/g,
    /setNavigationBarTitle\([\s\S]*?title\s*:\s*['"]([^'"]+)['"]/g
  ];

  const values = [];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      values.push(match[1]);
    }
  });

  return values.join('\n');
}

function extractRelevantText(filePath, text) {
  const ext = getExtension(filePath);
  if (ext === '.wxml') return extractWxmlText(text);
  if (ext === '.json') return extractJsonText(text);
  if (ext === '.js') return extractJsUiStrings(text);
  return text;
}

const findings = [];

targetFiles.forEach((filePath) => {
  const absPath = path.join(root, filePath);
  if (!fs.existsSync(absPath)) {
    findings.push({ filePath, term: '__MISSING__', snippet: 'target file missing' });
    return;
  }

  const source = read(filePath);
  const text = extractRelevantText(filePath, source);

  forbiddenTerms.forEach((term) => {
    if (text.includes(term)) {
      findings.push({
        filePath,
        term,
        snippet: term
      });
    }
  });
});

console.log('[verify-user-facing-wording] scanned files:', targetFiles.length);
console.log('[verify-user-facing-wording] forbidden terms:', forbiddenTerms.join(', '));

if (findings.length > 0) {
  console.error('[verify-user-facing-wording] FAIL: detected forbidden wording in user-facing surfaces.');
  findings.forEach(({ filePath, term, snippet }) => {
    console.error(`- ${filePath}: ${term} (${snippet})`);
  });
  process.exit(1);
}

console.log('[verify-user-facing-wording] PASS');
process.exit(0);
