// Apacche License
// Copyright (c) 2021, Sander van Woensel

import { PlatformAccessory } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory, MieleState } from './mieleBasePlatformAccessory';

import { MieleCurrentCoolingCharacteristic, MieleTargetCoolingCharacteristic,
  MieleTempCharacteristic, MieleTemperatureUnitCharacteristic, TemperatureType } 
  from './mieleCharacteristics';

//-------------------------------------------------------------------------------------------------
// Class Fridge
//-------------------------------------------------------------------------------------------------
export class MieleFridgePlatformAccessory extends MieleBasePlatformAccessory {

  //-----------------------------------------------------------------------------------------------
  constructor(
    platform: MieleAtHomePlatform,
    accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    this.mainService = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.mainService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    const currentCoolingStateCharacteristic = new MieleCurrentCoolingCharacteristic(this.platform, this.mainService,
      null, [MieleState.InUse]);
    
    const targetCoolingStateCharacterictic = new MieleTargetCoolingCharacteristic(this.platform, this.mainService,
      null, [MieleState.InUse]);
    const currentTemperatureCharacteristic = new MieleTempCharacteristic(this.platform, this.mainService, TemperatureType.Current);
    const targetTemperatureCharacteristic = new MieleTempCharacteristic(this.platform, this.mainService, TemperatureType.Target);
    const temperatureUnitCharacteristic = new MieleTemperatureUnitCharacteristic(this.platform, this.mainService);

    this.characteristics.push(currentCoolingStateCharacteristic);
    this.characteristics.push(targetCoolingStateCharacterictic);
    this.characteristics.push(currentTemperatureCharacteristic);
    this.characteristics.push(targetTemperatureCharacteristic);
    this.characteristics.push(temperatureUnitCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Thermostat
    this.mainService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getGeneric.bind(this, currentCoolingStateCharacteristic));
    
    // Fridge can only cool.
    this.mainService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('get', this.getGeneric.bind(this, targetCoolingStateCharacterictic))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
        ]});

    this.mainService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.getGeneric.bind(this, currentTemperatureCharacteristic));
    this.mainService.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('get', this.getGeneric.bind(this, targetTemperatureCharacteristic))
      .setProps({
        minValue: 1,    
        maxValue: 9,       // todo: set min/max based on API reply.
        minStep: 1,
      });
    this.mainService.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('get', this.getGeneric.bind(this, temperatureUnitCharacteristic)); // TODO: ignore a set request, Miele unit is leading
  }
  
}


