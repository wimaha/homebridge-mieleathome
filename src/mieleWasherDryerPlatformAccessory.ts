// Miele Washer Dryer accessory.
// Limitations:
// - A washer dryer does not allow you to take any action yet (view only).
// - Homekit maximum remaining duration characteristic is 1h which is too little for a washing machine, but it is the best we have.

import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory } from './mieleBasePlatformAccessory';

import request from 'request';

// Washer dryer
export class MieleWasherDryerPlatformAccessory extends MieleBasePlatformAccessory {
  private valveService: Service;

  private states = {
    active: this.platform.Characteristic.Active.INACTIVE,
  }

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

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Valve
    this.valveService.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setActive.bind(this))                
      .on('get', this.getActive.bind(this));

    this.valveService.getCharacteristic(this.platform.Characteristic.InUse)
      .on('get', this.getInUse.bind(this));

    this.valveService.getCharacteristic(this.platform.Characteristic.RemainingDuration)
      .on('get', this.getRemainingDuration.bind(this));

  }

  protected update(): void {
    this.platform.log.debug(`Updating. Request: ${this.requestStateConfig.url}`);

    request(this.requestStateConfig, (err, res, body) => {
      if (err) {
        this.platform.log.error(err);
      }
      else {
        this.valveService.setCharacteristic(this.platform.Characteristic.Active, this.getActiveFromResponse(JSON.parse(body))); 
      }
    });
  }

private getGeneric(callback: CharacteristicGetCallback, func: (response: any) => number) {
  request(this.requestStateConfig, (err, res, body) => {
    if (err) {
      callback(err);
    }
    else
    {
      callback(null, func(JSON.parse(body)));
    }
  });
}

  // Set active not supported for a Miele Washer Dryer.
  setActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`Set Characteristic Active: ${value}`);
    
    callback(null);

    // Undo state change to emulate a readonly state (since HomeKit valves are read/write)
    if(value !== this.states.active) {
      setTimeout(()=> {
        this.valveService.setCharacteristic(this.platform.Characteristic.Active, this.states.active); 
      }, 500);
    }
    
  }

  getActive(callback: CharacteristicGetCallback) {
    this.getGeneric(callback, this.getActiveFromResponse);
  }

  getInUse(callback: CharacteristicGetCallback) {
    this.getGeneric(callback, this.getInUseFromResponse);
  }

  getRemainingDuration(callback: CharacteristicGetCallback) {
    this.getGeneric(callback, this.getRemainingDurationFromResponse);
  }

  private getActiveFromResponse(response: any): number {
    this.states.active = this.platform.Characteristic.Active.ACTIVE;

    // Active
    // 1 = Off
    // 3 = Program selected
    // 5 = In use
    // 7 = Finished
    if (response.status.value_raw === 1) {
      this.states.active = this.platform.Characteristic.Active.INACTIVE;
    } 
    
    this.platform.log.debug('Get Characteristic Active:', this.states.active);
    return this.states.active;
  }

  private getInUseFromResponse(response: any) : number {

    let inUse = this.platform.Characteristic.InUse.NOT_IN_USE;

    // Program phase
    // 256 = No program selected
    // 261 - Rinsing
    // 260 = Main Wash
    // 267 = Anti-crease (active: finished)
    switch (response.programPhase.value_raw) {
      case 256:
      case 267:
        inUse = this.platform.Characteristic.InUse.NOT_IN_USE;
        break;
    
      default:
        inUse = this.platform.Characteristic.InUse.IN_USE;
        break;
    }
    
    this.platform.log.debug('Get Characteristic InUse:', inUse);
    return inUse;
  }

  private getRemainingDurationFromResponse(response: any) : number {

    let remainingDuration = response.remainingTime[0]*60*60 + response.remainingTime[1]*60;
    
    this.platform.log.debug('Get Characteristic RemainingDuration:', remainingDuration, '[s]');
    return remainingDuration;
  }
}
