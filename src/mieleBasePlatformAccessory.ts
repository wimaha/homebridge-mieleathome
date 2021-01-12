import { PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';

export interface MieleStatusResponse {
  status: {value_raw: number};
  programPhase: {value_raw: number};
  remainingTime: number[];
}

// -----------------------------------------------------------------------------------------------------------------------------------------
// Miele Base Accessory
// -----------------------------------------------------------------------------------------------------------------------------------------
export abstract class MieleBasePlatformAccessory {
  protected requestStateConfig: {headers: Record<string, unknown>};
  protected stateUrl: string;
  protected lastCacheUpdateTime: number;

  protected readonly CACHE_RETIREMENT_TIME_MS = 10;

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

  protected abstract update() : void;

    

}
