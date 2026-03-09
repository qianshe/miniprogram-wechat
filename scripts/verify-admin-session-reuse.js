#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const userJs = read('pages/user/user.js');
const guardJs = read('pages/admin/common/adminGuard.js');
const loginJs = read('pages/admin/login/login.js');
const orderListJs = read('pages/admin/order/list/list.js');

const toManageMatch = userJs.match(/toManagePage\(\)\s*{([\s\S]*?)\n\s*},/);
const toManageBody = toManageMatch ? toManageMatch[1] : '';

const hasDirectAdminNavigate = /\/pages\/admin\/index\/index/.test(toManageBody);
const hasPreNavigationGuard = /checkAdminAccess|getStorageSync\('isAdmin'\)|\/pages\/admin\/login\/login/.test(toManageBody) && /if\s*\(/.test(toManageBody);

const guardRedirectLogin = /redirectTo\(\{\s*url:\s*'\/pages\/admin\/login\/login'\s*\}\)/.test(guardJs);
const guardUsesValidSession = /hasValidAdminSession\(/.test(guardJs);
const loginAutoReuse = /onLoad\([\s\S]*?hasValidAdminSession\(\)[\s\S]*?reLaunch\(\{\s*url:\s*'\/pages\/admin\/index\/index'\s*\}\)/.test(loginJs);
const loginUsesUnifiedAuthWrite = /auth\.setAuth\(/.test(loginJs);
const rememberRead = /getStorageSync\('adminAccount'\)/.test(loginJs);
const rememberWrite = /setStorageSync\('adminAccount'/.test(loginJs);
const hasRememberAccount = rememberRead && rememberWrite;
const orderListUsesSharedGuard = /checkAdminAccess\(/.test(orderListJs) && !/auth\.checkAuth\(/.test(orderListJs);

const baselineDetected = hasDirectAdminNavigate && !hasPreNavigationGuard && guardRedirectLogin && !guardUsesValidSession && !loginUsesUnifiedAuthWrite && !hasRememberAccount;
const targetDetected = hasPreNavigationGuard && guardRedirectLogin && guardUsesValidSession && loginAutoReuse && loginUsesUnifiedAuthWrite && hasRememberAccount && orderListUsesSharedGuard;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-admin-session-reuse] STATE=${state}`);
console.log(`- user.toManagePage directNavigate: ${hasDirectAdminNavigate}`);
console.log(`- user.toManagePage preNavigationGuard: ${hasPreNavigationGuard}`);
console.log(`- adminGuard redirect login: ${guardRedirectLogin}`);
console.log(`- adminGuard uses valid session: ${guardUsesValidSession}`);
console.log(`- login auto session reuse: ${loginAutoReuse}`);
console.log(`- login uses auth.setAuth: ${loginUsesUnifiedAuthWrite}`);
console.log(`- remember account read/write: ${rememberRead}/${rememberWrite}`);
console.log(`- order list uses shared guard: ${orderListUsesSharedGuard}`);

if (!ok) {
  console.error('[verify-admin-session-reuse] FAIL: 管理员会话逻辑处于混合态，需人工确认。');
  process.exit(1);
}

console.log(`[verify-admin-session-reuse] PASS (${state})`);
process.exit(0);
