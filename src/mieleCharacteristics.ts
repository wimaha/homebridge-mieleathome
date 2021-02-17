// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { Service, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { DEVICES_INFO_URL, REVERT_ACTIVATE_REQUEST_TIMEOUT_MS } from './settings';
import { MieleAtHomePlatform, createErrorString } from './platform';
import { MieleStatusResponse, MieleState, MieleStatusResponseTemp } from './mieleBasePlatformAccessory';
import axios from 'axios';

enum MieleProcessAction {
  Stop = 2,
  Start = 1,
}

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
    private readonly inactiveStates: MieleState[] | null,
    private readonly activeStates: MieleState[] | null,
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

    if (this.inactiveStates) {
      if(this.inactiveStates.includes(response.status.value_raw)) {
        this.state = this.offState;
      } else {
        this.state = this.onState;
      }
    } else if (this.activeStates) {
      if(this.activeStates.includes(response.status.value_raw)) {
        this.state = this.onState;
      } else {
        this.state = this.offState;
      }
    } else {
      throw new Error('Neither active or inactive states supplied. Cannot determine state.');
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
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
  ) {
    super(platform, service, inactiveStates, activeStates, platform.Characteristic.InUse,
      platform.Characteristic.InUse.NOT_IN_USE,
      platform.Characteristic.InUse.IN_USE);
  }
}

//-------------------------------------------------------------------------------------------------
// Miele Active Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleActiveCharacteristic extends MieleBinaryStateCharacteristic {      
  
  private readonly actionsURL: string;

  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
    private serialNumber: string,
    private disableStopAction: boolean,
  ) {
    super(platform, service, inactiveStates, activeStates, platform.Characteristic.Active,
      platform.Characteristic.Active.INACTIVE,
      platform.Characteristic.Active.ACTIVE);

    this.actionsURL = DEVICES_INFO_URL + '/' + serialNumber + '/actions';
  }

  //-------------------------------------------------------------------------------------------------
  // Set active
  async set(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`Set characteristic Active to: ${value}`);
    
    callback(null);

    if(this.disableStopAction && value===0) {
      this.platform.log.info(`${this.serialNumber}: Ignoring stop request.`);
      this.undoSetState(value);
      return;
    }

    try {
      // Retrieve allowed actions for this device in the current state.
      const response = await axios.get(this.actionsURL, this.platform.getHttpRequestConfig());
      this.platform.log.debug(`${this.serialNumber}: Allowed process actions: ${response.data.processAction} `);

      let mieleProcesAction = MieleProcessAction.Stop;
      if(value===1) {
        mieleProcesAction = MieleProcessAction.Start;
      }

      // If allowed to execute action.
      if(response.data.processAction.includes(mieleProcesAction)) {
        this.platform.log.info(`${this.serialNumber}: Process action "${MieleProcessAction[mieleProcesAction]}" (${mieleProcesAction}).`);
        const response = await axios.put(this.actionsURL, {processAction: mieleProcesAction}, this.platform.getHttpRequestConfig());
        this.platform.log.debug(`Process action response code: ${response.status}: "${response.statusText}"`);
      } else {
        // Requested action not allowed
        this.platform.log.info(`${this.serialNumber}: Ignoring request to set device to HomeKit value ${value}. Miele action `+
          `"${MieleProcessAction[mieleProcesAction]}" (${mieleProcesAction}) not allowed in current device state. Allowed Miele process `+
          `actions: ${response.data.processAction ? '<none>' : response.data.processAction}`);
        
        // Undo state change to emulate a readonly state (since HomeKit valves are read/write)
        this.undoSetState(value);
      }      
    } catch (response) {
      this.platform.log.error( createErrorString(response) );
    }
  }

  //-------------------------------------------------------------------------------------------------
  // Undo state
  private undoSetState(value: CharacteristicValue) {
    if(value !== this.state) {
      this.platform.log.info(`${this.serialNumber}: Reverting state to ${this.state}.`);

      setTimeout(()=> {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state); 
      }, REVERT_ACTIVATE_REQUEST_TIMEOUT_MS);
    }
  }

}

//-------------------------------------------------------------------------------------------------
// Miele Remaining Duration Characteristic
//-------------------------------------------------------------------------------------------------
export class MieleRemainingDurationCharacteristic implements IMieleCharacteristic {
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

//-------------------------------------------------------------------------------------------------
// Miele Temperature Characteristic
//-------------------------------------------------------------------------------------------------
export enum TemperatureType {
  Target,
  Current
}

export class MieleTempCharacteristic implements IMieleCharacteristic {
  protected temp: number;
  
  private readonly NULL_VALUE = 2**16/-2;

  constructor(
    protected platform: MieleAtHomePlatform,
    protected service: Service,
    private type: TemperatureType, 
  ) {
    this.temp = 0; 
  }


  //-------------------------------------------------------------------------------------------------
  // These methods always returns the status from cache wich might be outdated, but will be
  // updated as soon as possible by the update function.
  get(callback: CharacteristicGetCallback) {
    callback(null, this.temp);
  }

  //-------------------------------------------------------------------------------------------------
  set(_value: CharacteristicValue, _callback: CharacteristicSetCallback): void {
    this.platform.log.error('Attempt to set temperature characteristic. Ignored.');
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    let tempArray: MieleStatusResponseTemp[];
    switch(this.type) {
      case TemperatureType.Target:
        tempArray = response.targetTemperature;
        break;
      case TemperatureType.Current:
        tempArray = response.temperature;
        break;
    }
    
    if(tempArray.length > 0) {
      const valueRaw = tempArray[0].value_raw; // Fetch first temperature only.
      this.platform.log.debug(`Parsed first ${TemperatureType[this.type]} Temperature from API response: ${valueRaw} [C/100]`);
    
      if(valueRaw !== this.NULL_VALUE) {
        this.temp = valueRaw / 100.0; // Miele returns values in deci-Celsius
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.temp); 
      } else {
        // Set target temperature to 0 when no target temperature available since device is off.
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, 0);
      }
    }
  }

}
