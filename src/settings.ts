// Apacche License
// Copyright (c) 2021, Sander van Woensel

// This is the name of the platform that users will use to register the plugin in the Homebridge config.json
export const PLATFORM_NAME = 'MieleAtHome';

// This must match the name of your plugin as defined the package.json
export const PLUGIN_NAME = 'homebridge-mieleathome';

// Miele REST API and protocol verison. 
export const BASE_URL = 'https://api.mcs3.miele.com/v1/devices';

// Cache is considered invalid / I need of a refresh when it is older than this value in milliseconds.
export const CACHE_RETIREMENT_TIME_MS = 1000;

// Duration in milliseconds afterwhich to undo the status of the water tap activated/deactivate when not allowed
// to turn on/off the washing machine according to the Miele API.
export const REVERT_ACTIVATE_REQUEST_TIMEOUT_MS = 500;

