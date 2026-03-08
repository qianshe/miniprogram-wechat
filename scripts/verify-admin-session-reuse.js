#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const userJs = read('pages/user/user.js');
const guardJs = read('pages/admin/common/adminGuard.js');
const loginJs = read('pages/admin/login/login.js');

const toManageMatch = userJs.match(/toManagePage\(\)\s*{([\s\S]*?)\n\s*},/);
const toManageBody = toManageMatch ? toManageMatch[1] : '';

const hasDirectAdminNavigate = /\/pages\/admin\/index\/index/.test(toManageBody);
const hasPreNavigationGuard = /checkAdminAccess|getStorageSync\('isAdmin'\)|\/pages\/admin\/login\/login/.test(toManageBody) && /if\s*\(/.test(toManageBody);

const guardRedirectLogin = /redirectTo\(\{\s*url:\s*'\/pages\/admin\/login\/login'\s*\}\)/.test(guardJs);
const loginAutoReuse = /onLoad\([\s\S]*?getStorageSync\('isAdmin'\)[\s\S]*?reLaunch\(\{\s*url:\s*'\/pages\/admin\/index\/index'\s*\}\)/.test(loginJs);
const rememberRead = /getStorageSync\('adminAccount'\)/.test(loginJs);
const rememberWrite = /setStorageSync\('adminAccount'/.test(loginJs);
const hasRememberAccount = rememberRead && rememberWrite;

const baselineDetected = hasDirectAdminNavigate && !hasPreNavigationGuard && guardRedirectLogin && loginAutoReuse && !hasRememberAccount;
const targetDetected = hasPreNavigationGuard && guardRedirectLogin && hasRememberAccount;

const ok = baselineDetected || targetDetected;
const state = baselineDetected ? 'BASELINE' : targetDetected ? 'TARGET' : 'MIXED';

console.log(`[verify-admin-session-reuse] STATE=${state}`);
console.log(`- user.toManagePage directNavigate: ${hasDirectAdminNavigate}`);
console.log(`- user.toManagePage preNavigationGuard: ${hasPreNavigationGuard}`);
console.log(`- adminGuard redirect login: ${guardRedirectLogin}`);
console.log(`- login auto session reuse: ${loginAutoReuse}`);
console.log(`- remember account read/write: ${rememberRead}/${rememberWrite}`);

if (!ok) {
  console.error('[verify-admin-session-reuse] FAIL: 管理员会话逻辑处于混合态，需人工确认。');
  process.exit(1);
}

console.log(`[verify-admin-session-reuse] PASS (${state})`);
process.exit(0);
