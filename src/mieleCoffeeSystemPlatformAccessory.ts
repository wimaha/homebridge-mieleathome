// Apacche License
// Copyright (c) 2021, Arkadiusz Wahlig

import { PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory, MieleState } from './mieleBasePlatformAccessory';

import { MieleOnCharacteristic, MieleOutletInUseCharacteristic } from './mieleCharacteristics';
import { timeStamp } from 'console';

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
  
    this.mainService = this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.mainService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    const onCharacteristic = new MieleOnCharacteristic(this.platform, this.mainService, accessory.context.device.uniqueId);
    const inUseCharacteristic = new MieleOutletInUseCharacteristic(this.platform, this.mainService, null,
      [ MieleState.InUse, MieleState.Finished, MieleState.Cancelled ]);

    this.characteristics.push(onCharacteristic);
    this.characteristics.push(inUseCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Switch
    this.mainService.getCharacteristic(this.platform.Characteristic.On)
      .on('get', onCharacteristic.get.bind(onCharacteristic))
      .on('set', onCharacteristic.set.bind(onCharacteristic));

    this.mainService.getCharacteristic(this.platform.Characteristic.OutletInUse)
      .on('get', inUseCharacteristic.get.bind(inUseCharacteristic));
  }
  
}


