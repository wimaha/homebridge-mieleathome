// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { Service, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { MieleAtHomePlatform } from './platform';
import { MieleStatusResponse } from './mieleBasePlatformAccessory';
import axios from 'axios';

//-------------------------------------------------------------------------------------------------
// Interface Miele Characteristic
//-------------------------------------------------------------------------------------------------
export interface IMieleCharacteristic {
  get(callback: CharacteristicGetCallback): void; 
  set(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
  update(esponse: MieleStatusResponse): void;
}


//-------------------------------------------------------------------------------------------------
// Base class: Miele Binary State Characteristic
//-------------------------------------------------------------------------------------------------
abstract class MieleBinaryStateCharacteristic implements IMieleCharacteristic {
  protected state: number;
      
  constructor(
    protected platform: MieleAtHomePlatform,
    protected service: Service,
    private readonly inactiveStates: number[],
    private readonly characteristicType,
    private readonly offState: number,
    private readonly onState: number,
  ) {
    this.state = offState; 
  }


  //-------------------------------------------------------------------------------------------------
  // These methods always returns the status from cache wich might be outdated, but will be
  // updated as soon as possible by the update function.
  get(callback: CharacteristicGetCallback) {
    callback(null, this.state);
  }

  set(_value: CharacteristicValue, _callback: CharacteristicSetCallback): void {
    throw new Error('"set" method must be overridden.');
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    if(this.inactiveStates.includes(response.status.value_raw)) {
      this.state = this.offState;
    } else {
      this.state = this.onState;
    }
    
    this.platform.log.debug(`Parsed ${this.characteristicType.name} from API response: ${this.state}`);
    this.service.updateCharacteristic(this.characteristicType, this.state); 
  }

}

//-------------------------------------------------------------------------------------------------
// Miele InUse Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleInUseCharacteristic extends MieleBinaryStateCharacteristic {
      
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: number[],
  ) {
    super(platform, service, inactiveStates, platform.Characteristic.InUse,
      platform.Characteristic.InUse.NOT_IN_USE,
      platform.Characteristic.InUse.IN_USE);
  }
}

//-------------------------------------------------------------------------------------------------
// Miele Active Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleActiveCharacteristic extends MieleBinaryStateCharacteristic {      
  private readonly REVERT_ACTIVATE_REQUEST_TIMEOUT_MS = 500;
  private readonly START_ACTION = 1;
  private readonly STOP_ACTION = 2;
  
  private readonly actionsURL: string;
  private readonly requestConfig = {
    'headers': { 
      'Authorization': this.platform.token,
      'Content-Type': 'application/json',
    },
  };

  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: [number],
    private serialNumber: string,
  ) {
    super(platform, service, inactiveStates, platform.Characteristic.Active,
      platform.Characteristic.Active.INACTIVE,
      platform.Characteristic.Active.ACTIVE);

    this.actionsURL = this.platform.baseURL + '/' + serialNumber + '/actions';
  }

  //-------------------------------------------------------------------------------------------------
  // Set active
  async set(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`Set characteristic Active to: ${value}`);
    
    // Reply asap. Take care of errors later.
    callback(null);

    // Retrieve allowed actions for this device in the current state.
    try {
      const response = await axios.get(this.actionsURL, this.requestConfig);
      this.platform.log.debug(`${this.serialNumber}: Allowed process actions: ${response.data.processAction} `);

      let mieleProcesAction = this.STOP_ACTION;
      if(value===1) {
        mieleProcesAction = this.START_ACTION;
      }

      // If allowed to execute action.
      if(response.data.processAction.includes(mieleProcesAction)) {
        this.platform.log.info(`${this.serialNumber}: Process action "${mieleProcesAction}".`);
        await axios.put(this.actionsURL, {'processAction': mieleProcesAction}, this.requestConfig);
      } else {
        // Requested action not allowed
        this.platform.log.info(`${this.serialNumber}: Ignoring request to set device to HomeKit value ${value}. Miele action `+
          `"${mieleProcesAction}" not allowed in current device state. Allowed Miele process actions: "${response.data.processAction}"`);
        
        // Undo state change to emulate a readonly state (since HomeKit valves are read/write)
        if(value !== this.state) {
          this.platform.log.info(`${this.serialNumber}: Reverting state to ${this.state}.`);

          setTimeout(()=> {
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state); 
          }, this.REVERT_ACTIVATE_REQUEST_TIMEOUT_MS);
        }
      }
      
    } catch (response) {
      if(response.config && response.response) {
        this.platform.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}".`);
      } else {
        this.platform.log.error(response);
      }
    }
  }
}

//-------------------------------------------------------------------------------------------------
// Miele Remaining Duration Characteristic
//-------------------------------------------------------------------------------------------------
export class MieleRemainingDurationharacteristic implements IMieleCharacteristic {
  protected remainingDuration: number;
      
  constructor(
    protected platform: MieleAtHomePlatform,
    protected service: Service,
  ) {
    this.remainingDuration = 0; 
  }


  //-------------------------------------------------------------------------------------------------
  // These methods always returns the status from cache wich might be outdated, but will be
  // updated as soon as possible by the update function.
  get(callback: CharacteristicGetCallback) {
    callback(null, this.remainingDuration);
  }

  //-------------------------------------------------------------------------------------------------
  set(_value: CharacteristicValue, _callback: CharacteristicSetCallback): void {
    this.platform.log.error('Attempt to set remaining duration characteristic. Ignored.');
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    this.remainingDuration = response.remainingTime[0]*3600 + response.remainingTime[1]*60;
    this.platform.log.debug('Parsed RemainingDuration from API response:', this.remainingDuration, '[s]');
    this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.remainingDuration); 
  }

}
