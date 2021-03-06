// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { Service, PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory, MieleState } from './mieleBasePlatformAccessory';

import { MieleActiveCharacteristic, MieleInUseCharacteristic, MieleRemainingDurationCharacteristic, MieleTempCharacteristic,
  TemperatureType } 
  from './mieleCharacteristics';

//-------------------------------------------------------------------------------------------------
// Class Washing Machine and Washer Dryer combination
//-------------------------------------------------------------------------------------------------
export class MieleWasherDryerPlatformAccessory extends MieleBasePlatformAccessory {
  private tempService: Service | undefined;

  //-----------------------------------------------------------------------------------------------
  constructor(
    platform: MieleAtHomePlatform,
    accessory: PlatformAccessory,
    disableStopAction: boolean,
    disableTempSensor: boolean,
  ) {
    super(platform, accessory);

    this.mainService = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.mainService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
    this.mainService.setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.WATER_FAUCET);

    const activeCharacteristic = new MieleActiveCharacteristic(this.platform, this.mainService,
      [MieleState.Off, MieleState.Finished, MieleState.Cancelled], null,
      accessory.context.device.uniqueId, disableStopAction);
    const inUseCharacteristic = new MieleInUseCharacteristic(this.platform, this.mainService,
      null, [MieleState.InUse, MieleState.Finished, MieleState.Cancelled]);
    const remainingDurationCharacteristic = new MieleRemainingDurationCharacteristic(this.platform, this.mainService);
    
    this.characteristics.push(activeCharacteristic);
    this.characteristics.push(inUseCharacteristic);
    this.characteristics.push(remainingDurationCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Valve
    this.mainService.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.getGeneric.bind(this, activeCharacteristic))
      .on('set', activeCharacteristic.set.bind(activeCharacteristic));

    this.mainService.getCharacteristic(this.platform.Characteristic.InUse)
      .on('get', this.getGeneric.bind(this, inUseCharacteristic));

    this.mainService.getCharacteristic(this.platform.Characteristic.RemainingDuration)
      .on('get', this.getGeneric.bind(this, remainingDurationCharacteristic));

    // Temperature sensor service
    this.tempService = this.accessory.getService(this.platform.Service.TemperatureSensor);
    if(!disableTempSensor) {
      this.platform.log.info(`${accessory.context.device.displayName}: Adding temperature sensor.`);
      this.tempService = this.accessory.getService(this.platform.Service.TemperatureSensor) ||
        this.accessory.addService(this.platform.Service.TemperatureSensor);

      const tempCharacteristic = new MieleTempCharacteristic(this.platform, this.tempService, TemperatureType.Target);
      this.characteristics.push(tempCharacteristic);
      this.tempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .on('get', this.getGeneric.bind(this, tempCharacteristic));

    } else if(this.tempService) {
      this.accessory.removeService(this.tempService);
      this.platform.log.info(`${accessory.context.device.displayName}: Removed temperature sensor.`);
    }


  }
  
}


