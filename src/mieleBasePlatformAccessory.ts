import { PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';

// -----------------------------------------------------------------------------------------------------------------------------------------
// Miele Base Accessory
// -----------------------------------------------------------------------------------------------------------------------------------------
export abstract class MieleBasePlatformAccessory {
  protected requestStateConfig: {method: string; url: string; headers: Record<string, unknown>};

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

    this.requestStateConfig = {
      'method': 'GET',
      'url': this.platform.baseURL + '/' + serialNumber + '/state',
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
