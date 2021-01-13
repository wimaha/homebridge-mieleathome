// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { PlatformAccessory, CharacteristicGetCallback } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { IMieleCharacteristic } from './mieleCharacteristics';

import axios from 'axios';


//-------------------------------------------------------------------------------------------------
// Interface Miele status response
//-------------------------------------------------------------------------------------------------
export interface MieleStatusResponse {
  status: {value_raw: number};
  programPhase: {value_raw: number};
  remainingTime: number[];
}

//-------------------------------------------------------------------------------------------------
// Class Base Miele Accessory
//-------------------------------------------------------------------------------------------------
export abstract class MieleBasePlatformAccessory {
  private requestStateConfig: {headers: Record<string, unknown>};
  private stateUrl: string;
  private lastCacheUpdateTime: number;
  private cacheUpdateQueued = false;
  protected characteristics: IMieleCharacteristic[] = [];

  // Readonly constants
  protected readonly CACHE_RETIREMENT_TIME_MS = 1000;

  //-------------------------------------------------------------------------------------------------
  constructor(
    protected readonly platform: MieleAtHomePlatform,
    protected readonly accessory: PlatformAccessory,
    protected readonly model: string,
    protected readonly firmwareRevision: string,
    protected readonly serialNumber: string,
  ) {

    // Set accessory information.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Miele')
      .setCharacteristic(this.platform.Characteristic.Model, model)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, firmwareRevision)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, serialNumber);

    this.stateUrl = this.platform.baseURL + '/' + serialNumber + '/state';
    this.lastCacheUpdateTime = 0;

    this.requestStateConfig = {
      'headers': { 
        'Authorization': this.platform.token,
        'Content-Type': 'application/json',
      },
    };

    // Start polling
    if(this.platform.pollInterval > 0) {
      setInterval(this.update.bind(this), this.platform.pollInterval*1000);
    }

  }

  //-------------------------------------------------------------------------------------------------
  protected isCacheRetired(): boolean {
    const retired = (this.lastCacheUpdateTime < Date.now() - this.CACHE_RETIREMENT_TIME_MS) &&
       !this.cacheUpdateQueued;

    if (retired) {
      this.platform.log.info('Cache retired. Status update enforced.');
    }
    return retired;
  }

  //-----------------------------------------------------------------------------------------------
  protected getGeneric(characteristic: IMieleCharacteristic, callback: CharacteristicGetCallback) {
    if (this.isCacheRetired()) {
      this.update();
    }
    return characteristic.get(callback);
  }

  //-----------------------------------------------------------------------------------------------
  // Update all characteristics
  protected update(): void {
    this.platform.log.debug(`Update called. Requesting: ${this.stateUrl}`);
    this.cacheUpdateQueued = true;

    axios.get(this.stateUrl, this.requestStateConfig).then( (response) => {
      for(const characteristic of this.characteristics) {
        characteristic.update(response.data);
      }
      
      this.lastCacheUpdateTime = Date.now();
      this.cacheUpdateQueued = false;
    }).catch(response => {
      if(response.config && response.response) {
        this.platform.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}".`);
      } else {
        this.platform.log.error(response);
      }
    });
  }

}
