// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { PlatformAccessory, CharacteristicGetCallback, Service } from 'homebridge';

import { DEVICES_INFO_URL, CACHE_RETIREMENT_TIME_MS } from './settings';
import { MieleAtHomePlatform, createErrorString } from './platform';
import { IMieleCharacteristic } from './mieleCharacteristics';

import axios from 'axios';


export enum MieleState {
  Off = 1,
  ProgramSelected = 3,
  WaitingToStart = 4,
  InUse = 5,
  Finished = 7,
  Cancelled = 9,
}

//-------------------------------------------------------------------------------------------------
// Interface Miele status response
//-------------------------------------------------------------------------------------------------
export interface MieleStatusResponseTemp {
  value_raw: number; value_localized: null|string; unit: string;
}

export interface MieleStatusResponse {
  status: {value_raw: number};
  programPhase: {value_raw: number};
  remainingTime: number[];
  temperature: MieleStatusResponseTemp[];
  targetTemperature: MieleStatusResponseTemp[];
}

//-------------------------------------------------------------------------------------------------
// Class Base Miele Accessory
//-------------------------------------------------------------------------------------------------
export abstract class MieleBasePlatformAccessory {
  private stateUrl = DEVICES_INFO_URL + '/' + this.accessory.context.device.uniqueId + '/state';
  private lastCacheUpdateTime = 0;
  private cacheUpdateQueued = false;
  protected mainService!: Service;
  protected characteristics: IMieleCharacteristic[] = [];

  //-------------------------------------------------------------------------------------------------
  constructor(
    protected readonly platform: MieleAtHomePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    // Set accessory information.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Miele')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.modelNumber)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareRevision)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uniqueId);

    // Start polling
    if(this.platform.pollInterval > 0) {
      setInterval(this.update.bind(this), this.platform.pollInterval*1000);
    }

  }

  //-------------------------------------------------------------------------------------------------
  protected isCacheRetired(): boolean {
    const retired = (this.lastCacheUpdateTime < Date.now() - CACHE_RETIREMENT_TIME_MS) &&
       !this.cacheUpdateQueued;

    if (retired) {
      this.platform.log.debug('Cache retired. Status update enforced.');
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

    axios.get(this.stateUrl, this.platform.getHttpRequestConfig()).then( (response) => {
      for(const characteristic of this.characteristics) {
        characteristic.update(response.data);
      }
      
      this.lastCacheUpdateTime = Date.now();
      this.cacheUpdateQueued = false;

      this.mainService.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT);
      
    }).catch(response => {
      this.platform.log.error( createErrorString(response) );
      this.mainService.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.GENERAL_FAULT);
    });
  }

}
