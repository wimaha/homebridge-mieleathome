// Apacche License
// Copyright (c) 2021, Arkadiusz Wahlig

import { PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory } from './mieleBasePlatformAccessory';

import { MielePowerCharacteristic } from './mieleCharacteristics';

//-------------------------------------------------------------------------------------------------
// Class Coffee System
//-------------------------------------------------------------------------------------------------
export class MieleCoffeeSystemPlatformAccessory extends MieleBasePlatformAccessory {

  //-----------------------------------------------------------------------------------------------
  constructor(
    platform: MieleAtHomePlatform,
    accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    this.mainService = this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.mainService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    const powerCharacteristic = new MielePowerCharacteristic(this.platform, this.mainService, accessory.context.device.uniqueId);

    this.characteristics.push(powerCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Switch
    this.mainService.getCharacteristic(this.platform.Characteristic.On)
      .on('get', powerCharacteristic.get.bind(powerCharacteristic))
      .on('set', powerCharacteristic.set.bind(powerCharacteristic));
  }
  
}


