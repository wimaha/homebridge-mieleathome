// Apacche License
// Copyright (c) 2021, Sander van Woensel

import { PlatformAccessory } from 'homebridge';
import axios from 'axios';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory, MieleState } from './mieleBasePlatformAccessory';

import { MieleCurrentCoolingCharacteristic, MieleTargetCoolingCharacteristic,
  MieleTempCharacteristic, MieleTargetTempCharacteristic, MieleTemperatureUnitCharacteristic, TemperatureType } 
  from './mieleCharacteristics';

//-------------------------------------------------------------------------------------------------
// Class Fridge
//-------------------------------------------------------------------------------------------------
export class MieleFridgePlatformAccessory extends MieleBasePlatformAccessory {

  //-----------------------------------------------------------------------------------------------
  constructor(
    platform: MieleAtHomePlatform,
    accessory: PlatformAccessory,
    disableStopAction: boolean,
    disableChangeTargetTemperature: boolean,
  ) {
    super(platform, accessory);

    this.mainService = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.mainService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    const currentCoolingStateCharacteristic = new MieleCurrentCoolingCharacteristic(this.platform, this.mainService,
      null, [MieleState.InUse]);
    const targetCoolingStateCharacterictic = new MieleTargetCoolingCharacteristic(this.platform, this.mainService,
      null, [MieleState.InUse], accessory.context.device.uniqueId, disableStopAction);

    const currentTemperatureCharacteristic = new MieleTempCharacteristic(this.platform, this.mainService,
      TemperatureType.Current, this.platform.Characteristic.CurrentTemperature, 0);
    const targetTemperatureCharacteristic = new MieleTargetTempCharacteristic(this.platform,
      this.mainService, accessory.context.device.uniqueId, 1, disableChangeTargetTemperature);
    const temperatureUnitCharacteristic = new MieleTemperatureUnitCharacteristic(this.platform, this.mainService);

    this.characteristics.push(currentCoolingStateCharacteristic);
    this.characteristics.push(targetCoolingStateCharacterictic);
    this.characteristics.push(currentTemperatureCharacteristic);
    this.characteristics.push(targetTemperatureCharacteristic);
    this.characteristics.push(temperatureUnitCharacteristic);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Thermostat
    this.mainService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .on('get', currentCoolingStateCharacteristic.get.bind(currentCoolingStateCharacteristic));
    
    // Fridge can only cool.
    this.mainService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('get', targetCoolingStateCharacterictic.get.bind(targetCoolingStateCharacterictic))
      .on('set', targetCoolingStateCharacterictic.set.bind(targetCoolingStateCharacterictic))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
        ]});

    this.mainService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', currentTemperatureCharacteristic.get.bind(currentTemperatureCharacteristic))
      .setProps({
        minValue: -50,
        maxValue: 100,
      });

    // Retrieve allowed temperature range.
    axios.get(this.platform.getActionsUrl(accessory.context.device.uniqueId),
      this.platform.getHttpRequestConfig())
      .then((response) => {
        const targetTemperature = response.data.targetTemperature[0];

        this.platform.log.info(`${accessory.context.device.displayName} (${accessory.context.device.uniqueId}): `+
          `Setting target temperature range for zone 1 to: ${JSON.stringify(targetTemperature)}.`);
        
        this.mainService.getCharacteristic(this.platform.Characteristic.TargetTemperature)
          .setProps({
            minValue: targetTemperature?.min,    
            maxValue: targetTemperature?.max,
            minStep: 1, // Hardcoded to 1 no info about possible steps available.
          });

      })
      .catch((reason) => {
        this.platform.log.error(`${accessory.context.device.displayName} (${accessory.context.device.uniqueId}): `+
          'Failed to retrieve target temperature range. Error: '+reason);
      });

    this.mainService.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('get', targetTemperatureCharacteristic.get.bind(targetTemperatureCharacteristic))
      .on('set', targetTemperatureCharacteristic.set.bind(targetTemperatureCharacteristic));

    this.mainService.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('get', temperatureUnitCharacteristic.get.bind(temperatureUnitCharacteristic));
    // TODO: base on what miele initial state returns and disallow any other setting
  }
  
}


