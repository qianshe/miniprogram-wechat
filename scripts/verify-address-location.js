#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const addressJs = read('pages/address/address.js');
const appJsonRaw = read('app.json');
const appJson = JSON.parse(appJsonRaw);

const privateInfos = Array.isArray(appJson.requiredPrivateInfos) ? appJson.requiredPrivateInfos : [];
const usesChooseLocation = /wx\.chooseLocation\(/.test(addressJs);
const hasPermissionFallback = /isLocationAuthDenied/.test(addressJs) && /handleLocationPermissionDenied/.test(addressJs) && /wx\.openSetting\(/.test(addressJs);

const hasChooseAddressDeclaration = privateInfos.includes('chooseAddress');
const hasChooseLocationDeclaration = privateInfos.includes('chooseLocation');

const baselineDetected = usesChooseLocation && hasPermissionFallback && hasChooseAddressDeclaration && !hasChooseLocationDeclaration;
const targetDetected = usesChooseLocation && hasPermissionFallback && hasChooseLocationDeclaration;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-address-location] STATE=${state}`);
console.log(`- uses wx.chooseLocation: ${usesChooseLocation}`);
console.log(`- has denied-permission fallback flow: ${hasPermissionFallback}`);
console.log(`- requiredPrivateInfos includes chooseAddress: ${hasChooseAddressDeclaration}`);
console.log(`- requiredPrivateInfos includes chooseLocation: ${hasChooseLocationDeclaration}`);

if (!ok) {
  console.error('[verify-address-location] FAIL: 地址地图能力声明与代码状态不一致。');
  process.exit(1);
}

console.log(`[verify-address-location] PASS (${state})`);
process.exit(0);
