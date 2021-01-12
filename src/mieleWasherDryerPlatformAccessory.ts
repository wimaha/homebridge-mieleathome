import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleBasePlatformAccessory, MieleStatusResponse } from './mieleBasePlatformAccessory';

import axios from 'axios';

// Miele Washer Dryer accessory. 
export class MieleWasherDryerPlatformAccessory extends MieleBasePlatformAccessory {
  private valveService: Service;

  private states = {
    active: this.platform.Characteristic.Active.INACTIVE,
    inUse: this.platform.Characteristic.InUse.NOT_IN_USE,
    remainingDuration: 0,
  };

  private readonly REVERT_ACTIVATE_REQUEST_TIMEOUT_MS = 500;

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
    this.platform.log.debug(`Update called. Requesting: ${this.stateUrl}`);

    axios.get(this.stateUrl, this.requestStateConfig).then( (response) => {
      this.valveService.updateCharacteristic(this.platform.Characteristic.Active, this.getActiveFromResponse(response.data)); 
      this.valveService.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUseFromResponse(response.data)); 
      this.valveService.updateCharacteristic(this.platform.Characteristic.RemainingDuration,
        this.getRemainingDurationFromResponse(response.data)); 
      
      this.lastCacheUpdateTime = Date.now();
    }).catch(response => {
      if(response.config && response.response) {
        this.platform.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}".`);
      } else {
        this.platform.log.error(response);
      }
    });
  }

  private isCacheRetired(): boolean {
    const retired = this.lastCacheUpdateTime < Date.now() - this.CACHE_RETIREMENT_TIME_MS;

    this.platform.log.info('Cache retired. Status update enforced.');
    return retired;
  }

  // Set active not supported for a Miele Washer Dryer.
  setActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`Set Characteristic Active: ${value}`);
    
    callback(null);

    // Undo state change to emulate a readonly state (since HomeKit valves are read/write)
    if(value !== this.states.active) {
      setTimeout(()=> {
        this.valveService.updateCharacteristic(this.platform.Characteristic.Active, this.states.active); 
      }, this.REVERT_ACTIVATE_REQUEST_TIMEOUT_MS);
    }
    
  }

  // These methods always returns the status from cache wich might be outdated, but will be
  // updated as soon as possible by the update function.
  getActive(callback: CharacteristicGetCallback) {
    if (this.isCacheRetired()) {
      this.update();
    }
    callback(null, this.states.active);
  }

  getInUse(callback: CharacteristicGetCallback) {
    if (this.isCacheRetired()) {
      this.update();
    }
    callback(null, this.states.inUse);
  }

  getRemainingDuration(callback: CharacteristicGetCallback) {
    if (this.isCacheRetired()) {
      this.update();
    }
    callback(null, this.states.remainingDuration);
  }

  private getActiveFromResponse(response: MieleStatusResponse): number {
    this.states.active = this.platform.Characteristic.Active.ACTIVE;

    // Active
    // 1 = Off
    // 3 = Program selected
    // 5 = In use
    // 7 = Finished
    if (response.status.value_raw === 1) {
      this.states.active = this.platform.Characteristic.Active.INACTIVE;
    } 
    
    this.platform.log.debug('Parsed Active from API response:', this.states.active);
    return this.states.active;
  }

  private getInUseFromResponse(response: MieleStatusResponse) : number {
    // Program phase
    // 256 = No program selected
    // 261 - Rinsing
    // 260 = Main Wash
    // 267 = Anti-crease (active: finished)
    switch (response.programPhase.value_raw) {
      case 256:
      case 267:
        this.states.inUse = this.platform.Characteristic.InUse.NOT_IN_USE;
        break;
    
      default:
        this.states.inUse = this.platform.Characteristic.InUse.IN_USE;
        break;
    }
    
    this.platform.log.debug('Parsed InUse from API response:', this.states.inUse);
    return this.states.inUse;
  }

  private getRemainingDurationFromResponse(response: MieleStatusResponse) : number {

    this.states.remainingDuration = response.remainingTime[0]*60*60 + response.remainingTime[1]*60;
    
    this.platform.log.debug('Parsed RemainingDuration from API response:', this.states.remainingDuration, '[s]');
    return this.states.remainingDuration;
  }
}
