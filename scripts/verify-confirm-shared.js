const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

const pageFiles = [
  'pages/package/confirm/confirm',
  'pages/order/confirm/confirm'
];

const sharedComponents = {
  'c-confirm-address-sheet': '/components/c-confirm-address-sheet/c-confirm-address-sheet',
  'c-confirm-item-list': '/components/c-confirm-item-list/c-confirm-item-list',
  'c-confirm-form-card': '/components/c-confirm-form-card/c-confirm-form-card',
  'c-confirm-price-summary': '/components/c-confirm-price-summary/c-confirm-price-summary'
};

pageFiles.forEach((pageBase) => {
  const json = readJson(`${pageBase}.json`);
  const wxml = read(`${pageBase}.wxml`);

  Object.entries(sharedComponents).forEach(([name, componentPath]) => {
    assert.strictEqual(json.usingComponents[name], componentPath, `${pageBase}.json should register ${name}`);
    assert.ok(wxml.includes(`<${name}`), `${pageBase}.wxml should use <${name}>`);
  });
});

const packageJs = read('pages/package/confirm/confirm.js');
const orderJs = read('pages/order/confirm/confirm.js');

assert.ok(packageJs.includes('onSubmitOrder'), 'package confirm should keep onSubmitOrder');
assert.ok(orderJs.includes('submitOrder'), 'order confirm should keep submitOrder');

console.log('verify-confirm-shared: OK');
