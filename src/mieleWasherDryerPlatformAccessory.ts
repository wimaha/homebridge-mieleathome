// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { Service, PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory } from './mieleBasePlatformAccessory';

import { MieleActiveCharacteristic, MieleInUseCharacteristic, MieleRemainingDurationharacteristic } 
  from './mieleCharacteristics';

//-------------------------------------------------------------------------------------------------
// Class Washing Machine and Washer Dryer combination
//-------------------------------------------------------------------------------------------------
export class MieleWasherDryerPlatformAccessory extends MieleBasePlatformAccessory {
  private valveService: Service;

  // Readonly constants
  private readonly REVERT_ACTIVATE_REQUEST_TIMEOUT_MS = 500;

  //-----------------------------------------------------------------------------------------------
  constructor(
    platform: MieleAtHomePlatform,
    accessory: PlatformAccessory,
    model: string,
    firmwareRevision: string,
    serialNumber: string,
  ) {
    super(platform, accessory, model, firmwareRevision, serialNumber);

    this.valveService = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.valveService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
    this.valveService.setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.WATER_FAUCET);

    // Active
    // 1 = Off
    // 3 = Program selected
    // 5 = In use
    // 7 = Finished
    const activeCharacteristic = new MieleActiveCharacteristic(this.platform, this.valveService, [1]);
    const inUseCharacteristic = new MieleInUseCharacteristic(this.platform, this.valveService, [1, 2, 3, 4, 6, 7]);
    const remainingDurationCharacteristic = new MieleRemainingDurationharacteristic(this.platform, this.valveService);
    this.characteristics.push(activeCharacteristic);
    this.characteristics.push(inUseCharacteristic);
    this.characteristics.push(remainingDurationCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Valve
    this.valveService.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.getGeneric.bind(this, activeCharacteristic))
      .on('set', activeCharacteristic.set.bind(activeCharacteristic));

    this.valveService.getCharacteristic(this.platform.Characteristic.InUse)
      .on('get', this.getGeneric.bind(this, inUseCharacteristic));

    this.valveService.getCharacteristic(this.platform.Characteristic.RemainingDuration)
      .on('get', this.getGeneric.bind(this, remainingDurationCharacteristic));

  }
  
}
