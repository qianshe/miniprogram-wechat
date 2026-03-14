#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const selectedCaseArg = process.argv.find((arg) => arg.startsWith('--case='));
const selectedCase = selectedCaseArg ? selectedCaseArg.split('=')[1] : '';

const cloudFn = read('cloudfunctions/userDataManagement/index.js');
const addressApi = read('api/address.js');
const addressSelection = read('utils/addressSelection.js');
const addressJs = read('pages/address/address.js');
const appJson = JSON.parse(read('app.json'));
const privateInfos = Array.isArray(appJson.requiredPrivateInfos) ? appJson.requiredPrivateInfos : [];

const checks = {
  'reverse-geocode-complete': {
    cloudActionDefined: /async function reverseGeocodeLocation\(/.test(cloudFn),
    cloudActionRegistered: /case 'reverseGeocodeLocation':/.test(cloudFn),
    cloudUsesTencentEndpoint: /https:\/\/apis\.map\.qq\.com\/ws\/geocoder\/v1\//.test(cloudFn),
    cloudMapsRegionComponent: /addressComponent\.province/.test(cloudFn) && /addressComponent\.city/.test(cloudFn) && /addressComponent\.district/.test(cloudFn),
    apiExposesReverseGeocode: /const reverseGeocodeLocation =/.test(addressApi) && /'reverseGeocodeLocation'/.test(addressApi),
    utilsHasNormalizer: /function normalizeAddressFromLocation\(/.test(addressSelection),
    pageCallsReverseGeocodeApi: /addressApi\.reverseGeocodeLocation\(/.test(addressJs),
    pageUsesSingleNormalizerPath: /normalizeAddressFromLocation\(/.test(addressJs)
  },
  'reverse-geocode-partial': {
    cloudFallbackResult: /createFallbackGeocodeResult/.test(cloudFn) && /hasStructuredRegion:\s*false/.test(cloudFn),
    cloudPartialStatusHandled: /geocodeStatus:\s*'partial'/.test(cloudFn),
    cloudServiceErrorHandled: /geocodeStatus:\s*'service_error'/.test(cloudFn),
    cloudRequestErrorHandled: /geocodeStatus:\s*'request_failed'/.test(cloudFn),
    pageRemovesManualRegionPicker: !/onRegionChange\(/.test(addressJs),
    pageMapIsRequiredInSave: /请先在地图上选择位置/.test(addressJs),
    permissionFlowExplainsRequiredSelection: /地图选点是必填项/.test(addressJs)
  },
  'preserve-location-payload': {
    normalizerReturnsLocationFields: /locationName,\s*\n\s*locationAddress,\s*\n\s*latitude,\s*\n\s*longitude/.test(addressSelection),
    pageWritesLocationFields: /'formData\.locationName': normalizedAddress\.locationName/.test(addressJs)
      && /'formData\.locationAddress': normalizedAddress\.locationAddress/.test(addressJs)
      && /'formData\.latitude': normalizedAddress\.latitude/.test(addressJs)
      && /'formData\.longitude': normalizedAddress\.longitude/.test(addressJs),
    saveCloudPersistsLocationFields: /locationName: \(formData\.locationName \|\| ''\)\.trim\(\)/.test(addressJs)
      && /locationAddress: \(formData\.locationAddress \|\| ''\)\.trim\(\)/.test(addressJs)
      && /latitude: normalizeCoordinate\(formData\.latitude\)/.test(addressJs)
      && /longitude: normalizeCoordinate\(formData\.longitude\)/.test(addressJs),
    cloudPersistsLocationAddress: /locationAddress,\s*\n\s*latitude,\s*\n\s*longitude/.test(cloudFn)
      && /locationAddress:\s*normalizedLocationAddress/.test(cloudFn)
      && /updateData\.locationAddress = normalizeLocationName\(locationAddress\)/.test(cloudFn),
    mapSelectionRetainsPoiAndAddress: /locationName: \(res\.name \|\| res\.address \|\| ''\)\.trim\(\)/.test(addressJs)
      && /locationAddress: \(res\.address \|\| ''\)\.trim\(\)/.test(addressJs)
  },
  'permission-denied': {
    chooseLocationApi: /wx\.chooseLocation\(/.test(addressJs),
    chooseLocationDeclared: privateInfos.includes('chooseLocation'),
    locationPermissionDeclared: /"scope\.userLocation"\s*:\s*\{/.test(read('app.json')),
    deniedRecognizer: /isLocationAuthDenied\(/.test(addressJs),
    deniedHandler: /handleLocationPermissionDenied\(/.test(addressJs),
    deniedHandlerContainsOpenSetting: /handleLocationPermissionDenied\([\s\S]*?wx\.openSetting\(/.test(addressJs),
    cancelNoop: /errMsg\.includes\('cancel'\)[\s\S]*?return;/.test(addressJs)
  }
};

const caseAliases = {
  'page-wiring': 'reverse-geocode-complete'
};

const normalizedCase = caseAliases[selectedCase] || selectedCase;

if (normalizedCase && !checks[normalizedCase]) {
  console.error(`[verify-address-location] FAIL: 未知 case=${selectedCase}`);
  process.exit(1);
}

const casesToRun = normalizedCase
  ? [normalizedCase]
  : ['reverse-geocode-complete', 'reverse-geocode-partial', 'preserve-location-payload'];

let allPassed = true;

for (const caseName of casesToRun) {
  const resultMap = checks[caseName];
  const passed = Object.values(resultMap).every(Boolean);
  allPassed = allPassed && passed;

  console.log(`[verify-address-location] CASE=${caseName} PASS=${passed}`);
  Object.entries(resultMap).forEach(([name, value]) => {
    console.log(`- ${caseName}.${name}: ${value}`);
  });
}

const state = allPassed ? 'TARGET' : 'ERROR';
console.log(`[verify-address-location] STATE=${state}`);

if (!allPassed) {
  console.error('[verify-address-location] FAIL: 地址逆地理编码契约校验未通过。');
  process.exit(1);
}

console.log('[verify-address-location] PASS (TARGET)');
process.exit(0);
