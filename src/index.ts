import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { MieleAtHomePlatform } from './platform'; 

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, MieleAtHomePlatform);
}
