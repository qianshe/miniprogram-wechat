#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const selectedCaseArg = process.argv.find((arg) => arg.startsWith('--case='));
const selectedCase = selectedCaseArg ? selectedCaseArg.split('=')[1] : '';

const navigationUtil = read('miniprogram/pages/order/utils/navigation.js');
const addressApi = read('miniprogram/api/address.js');
const orderDetailJs = read('miniprogram/pages/order/detail/detail.js');
const orderDetailWxml = read('miniprogram/pages/order/detail/detail.wxml');
const adminOrderListJs = read('miniprogram/pages/admin/order/list/list.js');

const checks = {
  'open-map-app': {
    helperExported: /module\.exports\s*=\s*\{[\s\S]*openAdminNavigation/.test(navigationUtil),
    primaryPathUsesOpenMapApp: /mapContext\.openMapApp\(/.test(navigationUtil),
    openMapPayloadHasCoordinates: /openMapApp\([\s\S]*latitude:\s*payload\.latitude[\s\S]*longitude:\s*payload\.longitude/.test(navigationUtil),
    mapPathConstantDefined: /NAVIGATION_PATH_MAP_APP\s*=\s*'mapContext\.openMapApp'/.test(navigationUtil)
  },
  'fallback-open-location': {
    fallbackCallsOpenLocation: /wx\.openLocation\(/.test(navigationUtil),
    fallbackUsesSamePayloadCoordinates: /openLocation\([\s\S]*latitude:\s*payload\.latitude[\s\S]*longitude:\s*payload\.longitude/.test(navigationUtil),
    fallbackTriggeredAfterMapFailure: /fallbackFrom:\s*NAVIGATION_PATH_MAP_APP/.test(navigationUtil)
      && /mapAppError\s*=/.test(navigationUtil),
    openLocationPathConstantDefined: /NAVIGATION_PATH_OPEN_LOCATION\s*=\s*'wx\.openLocation'/.test(navigationUtil)
  },
  'order-detail-admin-entry': {
    adminRoutePassesIsAdmin: /url:\s*`\/pages\/order\/detail\/detail\?orderNo=\$\{orderno\}&isAdmin=true`/.test(adminOrderListJs),
    detailImportsNavigationHelper: /const navigationUtils = require\('\.\.\/utils\/navigation\.js'\);/.test(orderDetailJs),
    adminButtonUsesValidCoordinateGate: /wx:if="\{\{isAdmin && hasValidCoordinates\}\}"/.test(orderDetailWxml),
    adminButtonBindsNavigateHandler: /bindtap="handleAdminNavigate"/.test(orderDetailWxml),
    handlerCallsNavigationHelper: /navigationUtils\.navigateToAddress\([\s\S]*?address:\s*orderDetail\.address[\s\S]*?page:\s*this[\s\S]*?\)|navigationUtils\.openAdminNavigation\([\s\S]*?address:\s*orderDetail\.address[\s\S]*?page:\s*this[\s\S]*?\)/.test(orderDetailJs),
    adminViewLocationHidden: !/wx:if="\{\{isAdmin && orderInfo\.latitude && orderInfo\.longitude\}\}"/.test(orderDetailWxml),
    userViewLocationRemoved: !/bindtap="viewLocation"/.test(orderDetailWxml)
      && !/viewLocation/.test(orderDetailJs)
  },
  'missing-coordinates': {
    missingCoordinatesHideAdminButton: !/地址信息缺失，无法导航|地址信息不完整，无法导航/.test(orderDetailWxml),
    handlerStillGuardsMissingCoordinates: /if \(!this\.hasNavigationCoordinates\(navigationAddress\)\)\s*\{[\s\S]*地址信息不完整，无法导航/.test(orderDetailJs),
    missingCoordinateGateExists: /if \(inputLatitude !== null && inputLongitude !== null\)/.test(navigationUtil),
    geocodeResolverExists: /resolveGeocodeAddress\(/.test(navigationUtil)
      && /geocodeAddress\(geocodeQuery/.test(navigationUtil),
    usesAddressNormalizationPipeline: /normalizeAddressFromLocation\(/.test(navigationUtil),
    apiExposesGeocodeAddress: /const geocodeAddress\s*=/.test(addressApi) && /'geocodeAddress'/.test(addressApi)
  }
};

const caseAliases = {
  'admin-navigation': 'order-detail-admin-entry'
};

const normalizedCase = caseAliases[selectedCase] || selectedCase;

if (normalizedCase && !checks[normalizedCase]) {
  console.error(`[verify-admin-navigation] FAIL: 未知 case=${selectedCase}`);
  process.exit(1);
}

const casesToRun = normalizedCase
  ? [normalizedCase]
  : ['open-map-app', 'fallback-open-location', 'order-detail-admin-entry', 'missing-coordinates'];

let allPassed = true;

for (const caseName of casesToRun) {
  const resultMap = checks[caseName];
  const passed = Object.values(resultMap).every(Boolean);
  allPassed = allPassed && passed;

  console.log(`[verify-admin-navigation] CASE=${caseName} PASS=${passed}`);
  Object.entries(resultMap).forEach(([name, value]) => {
    console.log(`- ${caseName}.${name}: ${value}`);
  });
}

const state = allPassed ? 'TARGET' : 'ERROR';
console.log(`[verify-admin-navigation] STATE=${state}`);

if (!allPassed) {
  console.error('[verify-admin-navigation] FAIL: 管理端导航契约未覆盖订单详情入口、主路径、回退路径或缺少坐标处理。');
  process.exit(1);
}

console.log('[verify-admin-navigation] PASS (TARGET)');
process.exit(0);
