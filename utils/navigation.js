const addressApi = require('../api/address.js');
const { normalizeAddressFromLocation } = require('./addressSelection.js');

const NAVIGATION_PATH_MAP_APP = 'mapContext.openMapApp';
const NAVIGATION_PATH_OPEN_LOCATION = 'wx.openLocation';

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstText(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

function createNavigationError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function toAddressSource(input = {}) {
  if (input && typeof input.address === 'object' && input.address !== null) {
    return input.address;
  }
  return {};
}

function normalizeAddressInput(input = {}) {
  const addressSource = toAddressSource(input);
  const rawAddressText = typeof input.address === 'string' ? input.address : '';

  const province = pickFirstText(input.province, input.provinceName, addressSource.province, addressSource.provinceName);
  const city = pickFirstText(input.city, input.cityName, addressSource.city, addressSource.cityName);
  const district = pickFirstText(input.district, input.countyName, addressSource.district, addressSource.countyName);
  const locationName = pickFirstText(input.locationName, addressSource.locationName, addressSource.name);
  const locationAddress = pickFirstText(
    input.locationAddress,
    input.fullAddress,
    addressSource.locationAddress,
    addressSource.fullAddress,
    addressSource.address,
    rawAddressText
  );
  const detail = pickFirstText(input.detail, input.detailInfo, addressSource.detail, addressSource.detailInfo, locationAddress);

  const latitude = normalizeCoordinate(
    input.latitude !== undefined ? input.latitude : addressSource.latitude
  );
  const longitude = normalizeCoordinate(
    input.longitude !== undefined ? input.longitude : addressSource.longitude
  );

  const normalized = normalizeAddressFromLocation({
    currentAddress: {
      province,
      city,
      district,
      detail,
      locationName,
      locationAddress,
      latitude,
      longitude,
      region: province && city && district ? [province, city, district] : []
    }
  });

  return {
    ...normalized,
    latitude: normalizeCoordinate(normalized.latitude),
    longitude: normalizeCoordinate(normalized.longitude)
  };
}

function normalizeGeocodePayload(payload = {}) {
  const response = payload && typeof payload === 'object' ? payload : {};
  const source = response.data && typeof response.data === 'object'
    ? response.data
    : response;

  return {
    province: pickFirstText(source.province),
    city: pickFirstText(source.city),
    district: pickFirstText(source.district),
    detail: pickFirstText(source.detail, source.locationAddress, source.address),
    locationName: pickFirstText(source.locationName, source.title, source.name),
    locationAddress: pickFirstText(source.locationAddress, source.address),
    latitude: normalizeCoordinate(source.latitude !== undefined ? source.latitude : source.lat),
    longitude: normalizeCoordinate(source.longitude !== undefined ? source.longitude : source.lng)
  };
}

function buildGeocodeQuery(address = {}) {
  const normalizedAddress = normalizeAddressInput(address);
  return {
    province: normalizedAddress.province,
    city: normalizedAddress.city,
    district: normalizedAddress.district,
    detail: normalizedAddress.detail,
    locationName: normalizedAddress.locationName,
    locationAddress: normalizedAddress.locationAddress,
    addressText: pickFirstText(
      normalizedAddress.locationAddress,
      `${normalizedAddress.province}${normalizedAddress.city}${normalizedAddress.district}${normalizedAddress.detail}`
    )
  };
}

function resolveGeocodeAddress(options = {}) {
  if (typeof options.geocodeAddress === 'function') {
    return options.geocodeAddress;
  }
  if (typeof addressApi.geocodeAddress === 'function') {
    return addressApi.geocodeAddress;
  }
  return null;
}

async function resolveNavigationTarget(input = {}, options = {}) {
  const normalizedInput = normalizeAddressInput(input);
  const inputLatitude = normalizeCoordinate(normalizedInput.latitude);
  const inputLongitude = normalizeCoordinate(normalizedInput.longitude);

  if (inputLatitude !== null && inputLongitude !== null) {
    return {
      ...normalizedInput,
      latitude: inputLatitude,
      longitude: inputLongitude,
      coordinatesSource: 'input'
    };
  }

  const geocodeAddress = resolveGeocodeAddress(options);
  if (!geocodeAddress) {
    throw createNavigationError('NAV_MISSING_COORDINATES', '缺少坐标，且未提供地址地理编码能力', {
      stage: 'resolveCoordinates',
      fallbackAvailable: false
    });
  }

  const geocodeQuery = buildGeocodeQuery(normalizedInput);
  const hasGeocodeAddress = [
    geocodeQuery.province,
    geocodeQuery.city,
    geocodeQuery.district,
    geocodeQuery.detail,
    geocodeQuery.locationAddress,
    geocodeQuery.locationName,
    geocodeQuery.addressText
  ].some(Boolean);

  if (!hasGeocodeAddress) {
    throw createNavigationError('NAV_MISSING_ADDRESS', '缺少可用于地理编码的结构化地址', {
      stage: 'geocodeAddress',
      geocodeQuery
    });
  }

  let geocodeResponse;
  try {
    geocodeResponse = await geocodeAddress(geocodeQuery, {
      showLoading: false,
      showError: false
    });
  } catch (error) {
    throw createNavigationError('NAV_GEOCODE_FAILED', error && error.message ? error.message : '地址地理编码失败', {
      stage: 'geocodeAddress',
      geocodeQuery,
      cause: error
    });
  }

  const normalizedByGeocode = normalizeAddressFromLocation({
    geocodeResult: normalizeGeocodePayload(geocodeResponse),
    currentAddress: normalizedInput
  });

  const geocodedLatitude = normalizeCoordinate(normalizedByGeocode.latitude);
  const geocodedLongitude = normalizeCoordinate(normalizedByGeocode.longitude);

  if (geocodedLatitude === null || geocodedLongitude === null) {
    throw createNavigationError('NAV_GEOCODE_NO_COORDINATES', '地址地理编码未返回有效坐标', {
      stage: 'geocodeAddress',
      geocodeQuery,
      geocodeResponse
    });
  }

  return {
    ...normalizedByGeocode,
    latitude: geocodedLatitude,
    longitude: geocodedLongitude,
    coordinatesSource: 'geocode'
  };
}

function resolveMapContext(options = {}) {
  if (options.mapContext && typeof options.mapContext.openMapApp === 'function') {
    return options.mapContext;
  }

  const mapId = typeof options.mapId === 'string' ? options.mapId.trim() : '';
  if (!mapId) {
    return null;
  }

  if (typeof wx === 'undefined' || typeof wx.createMapContext !== 'function') {
    return null;
  }

  return wx.createMapContext(mapId, options.page);
}

function buildNavigationPayload(target = {}, options = {}) {
  const name = pickFirstText(target.locationName, target.locationAddress, '订单地址');
  const address = pickFirstText(target.locationAddress, `${target.province || ''}${target.city || ''}${target.district || ''}${target.detail || ''}`);
  const scale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 18;

  return {
    latitude: Number(target.latitude),
    longitude: Number(target.longitude),
    destination: address || name || '订单地址',
    name: name || '订单地址',
    address: address || name || '订单地址',
    scale
  };
}

function openMapAppWithContext(mapContext, payload) {
  return new Promise((resolve, reject) => {
    mapContext.openMapApp({
      latitude: payload.latitude,
      longitude: payload.longitude,
      destination: payload.destination,
      success: () => {
        resolve({
          ok: true,
          path: NAVIGATION_PATH_MAP_APP
        });
      },
      fail: (error) => {
        reject(createNavigationError('NAV_MAP_APP_FAILED', 'MapContext.openMapApp 调用失败', {
          stage: NAVIGATION_PATH_MAP_APP,
          cause: error
        }));
      }
    });
  });
}

function openLocationFallback(payload) {
  return new Promise((resolve, reject) => {
    wx.openLocation({
      latitude: payload.latitude,
      longitude: payload.longitude,
      name: payload.name,
      address: payload.address,
      scale: payload.scale,
      success: () => {
        resolve({
          ok: true,
          path: NAVIGATION_PATH_OPEN_LOCATION
        });
      },
      fail: (error) => {
        reject(createNavigationError('NAV_OPEN_LOCATION_FAILED', 'wx.openLocation 调用失败', {
          stage: NAVIGATION_PATH_OPEN_LOCATION,
          cause: error
        }));
      }
    });
  });
}

async function openAdminNavigation(input = {}, options = {}) {
  const navigationTarget = await resolveNavigationTarget(input, options);
  const payload = buildNavigationPayload(navigationTarget, options);
  const mapContext = resolveMapContext(options);

  let mapAppError = null;
  if (mapContext && typeof mapContext.openMapApp === 'function') {
    try {
      const mapResult = await openMapAppWithContext(mapContext, payload);
      return {
        ...mapResult,
        coordinatesSource: navigationTarget.coordinatesSource,
        coordinates: {
          latitude: payload.latitude,
          longitude: payload.longitude
        }
      };
    } catch (error) {
      mapAppError = error;
    }
  } else {
    mapAppError = createNavigationError('NAV_MAP_CONTEXT_UNAVAILABLE', 'MapContext 不可用，降级到 wx.openLocation', {
      stage: NAVIGATION_PATH_MAP_APP
    });
  }

  try {
    const fallbackResult = await openLocationFallback(payload);
    return {
      ...fallbackResult,
      fallbackFrom: NAVIGATION_PATH_MAP_APP,
      fallbackReason: mapAppError ? mapAppError.code : 'NAV_MAP_CONTEXT_UNAVAILABLE',
      coordinatesSource: navigationTarget.coordinatesSource,
      coordinates: {
        latitude: payload.latitude,
        longitude: payload.longitude
      }
    };
  } catch (error) {
    throw createNavigationError('NAVIGATION_FAILED', '导航失败：主路径与回退路径均不可用', {
      stage: NAVIGATION_PATH_OPEN_LOCATION,
      openMapAppError: mapAppError,
      cause: error
    });
  }
}

module.exports = {
  NAVIGATION_PATH_MAP_APP,
  NAVIGATION_PATH_OPEN_LOCATION,
  buildGeocodeQuery,
  resolveNavigationTarget,
  openAdminNavigation
};
