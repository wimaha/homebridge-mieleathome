// Apacche License
// Copyright (c) 2021, Sander van Woensel

// This is the name of the platform that users will use to register the plugin in the Homebridge config.json
export const PLATFORM_NAME = 'Miele@home';

// This must match the name of your plugin as defined the package.json
export const PLUGIN_NAME = 'homebridge-mieleathome';

// Miele REST API
export const BASE_URL = 'https://api.mcs3.miele.com';

// Device information URL. 
export const DEVICES_INFO_URL = BASE_URL+'/v1/devices';

// Token refresh URL.
export const REFRESH_TOKEN_URL = BASE_URL + '/thirdparty/token';

// Cache is considered invalid / I need of a refresh when it is older than this value in milliseconds.
export const CACHE_RETIREMENT_TIME_MS = 1000;

// Duration in milliseconds afterwhich to undo the status of the water tap activated/deactivate when not allowed
// to turn on/off the washing machine according to the Miele API.
export const REVERT_ACTIVATE_REQUEST_TIMEOUT_MS = 500;

// Item name used to store the API token on persistent storage.
export const TOKEN_STORAGE_NAME = PLATFORM_NAME+'.Token.json';

// Interval at which the token is checked for a possible required refresh.
// Miele tokens are valid for 30 days, checking once every 10min should be sufficient.
export const TOKEN_REFRESH_CHECK_INTERVAL_S = 600;