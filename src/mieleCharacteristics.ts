// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { Service, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { REVERT_ACTIVATE_REQUEST_TIMEOUT_MS } from './settings';
import { MieleAtHomePlatform, createErrorString } from './platform';
import { MieleStatusResponse, MieleState, MieleStatusResponseTemp } from './mieleBasePlatformAccessory';
import axios from 'axios';

enum MieleProcessAction {
  Start = 1,
  Stop = 2,
  Pause = 3,
  StartSuperFreezing = 4,
  StopSuperFreezing = 5,
  StartSuperCooling = 6,
  StopSuperCooling = 7,
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
// Miele Read Only Characteristic
//-------------------------------------------------------------------------------------------------
abstract class MieleReadOnlyCharacteristic implements IMieleCharacteristic {

  constructor(
    protected platform: MieleAtHomePlatform,
    protected service: Service,
    protected value,
  ) {
  }

  //-------------------------------------------------------------------------------------------------
  // These methods always returns the status from cache wich might be outdated, but will be
  // updated as soon as possible by the update function.
  get(callback: CharacteristicGetCallback) {
    callback(null, this.value);
  }

  //-------------------------------------------------------------------------------------------------
  set(_value: CharacteristicValue, _callback: CharacteristicSetCallback): void {
    this.platform.log.error('Attempt to set a read only characteristic. Ignored.');
  }

  //-------------------------------------------------------------------------------------------------
  update(_response: MieleStatusResponse): void {
    throw new Error('"update" method must be overridden.');
  }

}

//-------------------------------------------------------------------------------------------------
// Base class: Miele Binary State Characteristic
//-------------------------------------------------------------------------------------------------
abstract class MieleBinaryStateCharacteristic extends MieleReadOnlyCharacteristic {
      
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    private readonly inactiveStates: MieleState[] | null,
    private readonly activeStates: MieleState[] | null,
    protected readonly characteristicType,
    protected readonly offState: number,
    protected readonly onState: number,
  ) {
    super(platform, service, offState);
  }

  set(_value: CharacteristicValue, _callback: CharacteristicSetCallback): void {
    throw new Error('"set" method must be overridden.');
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {

    if (this.inactiveStates) {
      if(this.inactiveStates.includes(response.status.value_raw)) {
        this.value = this.offState;
      } else {
        this.value = this.onState;
      }
    } else if (this.activeStates) {
      if(this.activeStates.includes(response.status.value_raw)) {
        this.value = this.onState;
      } else {
        this.value = this.offState;
      }
    } else {
      throw new Error('Neither active or inactive states supplied. Cannot determine state.');
    }
    
    this.platform.log.debug(`Parsed ${this.characteristicType.name} from API response: ${this.value}`);
    this.service.updateCharacteristic(this.characteristicType, this.value); 
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
// Miele Current Cooling Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleCurrentCoolingCharacteristic extends MieleBinaryStateCharacteristic {
      
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
  ) {
    super(platform, service, inactiveStates, activeStates, platform.Characteristic.CurrentHeatingCoolingState,
      platform.Characteristic.CurrentHeatingCoolingState.OFF,
      platform.Characteristic.CurrentHeatingCoolingState.COOL);
  }
}




//-------------------------------------------------------------------------------------------------
// Miele Writable Binary State Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleWritableBinaryStateCharacteristic extends MieleBinaryStateCharacteristic {      
  
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
    characteristicType,
    private mieleOffState: MieleProcessAction,
    characteristicOff: number,
    private mieleOnState: MieleProcessAction,
    characteristicOn: number,
    private serialNumber: string,
    private disableDeactivateAction: boolean,
  ) {
    super(platform, service, inactiveStates, activeStates, characteristicType,
      characteristicOff,
      characteristicOn);
  }

  //-------------------------------------------------------------------------------------------------
  // Set
  async set(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`Set characteristic ${this.characteristicType.name} to: ${value}`);
    
    callback(null);

    if(this.disableDeactivateAction && value===this.offState) {
      this.platform.log.info(`${this.serialNumber}: Ignoring deactivate request. User disabled deactivation request for this device.`);
      this.undoSetState(value);
      return;
    }

    try {
      // Retrieve allowed actions for this device in the current state.
      const response = await axios.get(this.platform.getActionsUrl(this.serialNumber), this.platform.getHttpRequestConfig());
      this.platform.log.debug(`${this.serialNumber}: Allowed process actions: ${response.data.processAction} `);

      let mieleProcesAction = this.mieleOffState;
      if(value===this.onState) {
        mieleProcesAction = this.mieleOnState;
      }

      // If allowed to execute action.
      if(response.data.processAction.includes(mieleProcesAction)) {
        this.platform.log.info(`${this.serialNumber}: Process action "${MieleProcessAction[mieleProcesAction]}" (${mieleProcesAction}).`);
        const response = await axios.put(this.platform.getActionsUrl(this.serialNumber), {processAction: mieleProcesAction},
          this.platform.getHttpRequestConfig());
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
      this.service.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.GENERAL_FAULT);

    }
  }

  //-------------------------------------------------------------------------------------------------
  // Undo state
  private undoSetState(value: CharacteristicValue) {
    if(value !== this.value) {
      this.platform.log.info(`${this.serialNumber}: Reverting state to ${this.value}.`);

      setTimeout(()=> {
        this.service.updateCharacteristic(this.characteristicType, this.value); 
      }, REVERT_ACTIVATE_REQUEST_TIMEOUT_MS);
    }
  }

}

//-------------------------------------------------------------------------------------------------
// Miele Active Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleActiveCharacteristic extends MieleWritableBinaryStateCharacteristic {      
  
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
    serialNumber: string,
    disableStopAction: boolean,
  ) {
    super(platform, service, inactiveStates, activeStates, platform.Characteristic.Active,
      MieleProcessAction.Stop, platform.Characteristic.Active.INACTIVE,
      MieleProcessAction.Start, platform.Characteristic.Active.ACTIVE, 
      serialNumber, disableStopAction);

  }
}

//-------------------------------------------------------------------------------------------------
// Miele Target Cooling state Characteristic. 
//-------------------------------------------------------------------------------------------------
export class MieleTargetCoolingCharacteristic extends MieleWritableBinaryStateCharacteristic {      
  
  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    inactiveStates: MieleState[] | null,
    activeStates: MieleState[] | null,
    serialNumber: string,
    disableDeactivateAction: boolean,
  ) {
    super(platform, service, inactiveStates, activeStates, platform.Characteristic.TargetHeatingCoolingState,
      MieleProcessAction.StopSuperCooling, platform.Characteristic.CurrentHeatingCoolingState.OFF,
      MieleProcessAction.StartSuperCooling, platform.Characteristic.CurrentHeatingCoolingState.COOL, 
      serialNumber, disableDeactivateAction);
  }
}

//-------------------------------------------------------------------------------------------------
// Miele Remaining Duration Characteristic
//-------------------------------------------------------------------------------------------------
export class MieleRemainingDurationCharacteristic extends MieleReadOnlyCharacteristic {
      
  //private readonly MAX_HOMEKIT_DURATION_S = 3600;

  constructor(
    protected platform: MieleAtHomePlatform,
    protected service: Service,
  ) {
    super(platform, service, 0);
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    this.value = response.remainingTime[0]*3600 + response.remainingTime[1]*60;
    this.platform.log.debug('Parsed Remaining Duration from API response:', this.value, '[s]');

    // Clip to min and max value.
    const characteristic = this.service.getCharacteristic(this.platform.Characteristic.RemainingDuration);
    const maxValue = characteristic.props.maxValue;
    const minValue = characteristic.props.minValue;

    if(maxValue && minValue) {
      this.value = this.value > maxValue ? maxValue : this.value;
      this.value = this.value < minValue ? minValue : this.value;
    }

    this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.value); 
  }

}

//-------------------------------------------------------------------------------------------------
// Miele Temperature Characteristic
//-------------------------------------------------------------------------------------------------
export enum TemperatureType {
  Target,
  Current
}

export class MieleTempCharacteristic extends MieleReadOnlyCharacteristic {  
  private readonly NULL_VALUE = 2**16/-2;
  private readonly TEMP_CONVERSION_FACTOR = 100.0;
  protected readonly DEFAULT_ZONE = 1; // Currently only 1 temperature zone supported.

  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    protected type: TemperatureType,
    private offTemp: number, 
  ) {
    super(platform, service, offTemp);
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    let tempArray: MieleStatusResponseTemp[];
    let characteristic;
    let value = this.offTemp; // Set target temperature to 'off' when no target temperature available since device is off.

    switch(this.type) {
      case TemperatureType.Target:
        tempArray = response.targetTemperature;
        characteristic = this.platform.Characteristic.TargetTemperature;
        break;
      case TemperatureType.Current:
        tempArray = response.temperature;
        characteristic = this.platform.Characteristic.CurrentTemperature;

        break;
    }
    
    if(tempArray.length > 0) {
      const valueRaw = tempArray[this.DEFAULT_ZONE-1].value_raw; // Fetch first temperature only.
      this.platform.log.debug(`Parsed zone ${this.DEFAULT_ZONE} ${TemperatureType[this.type]} `+
        `Temperature from API response: ${valueRaw} [C/${this.TEMP_CONVERSION_FACTOR}]`);
    
      if(valueRaw !== this.NULL_VALUE) {
        value = valueRaw / this.TEMP_CONVERSION_FACTOR; // Miele returns values in centi-Celsius
      }
      
      // Update temperature only when it changed with respect to previous value.
      // this prevents spamming the error log with warning messages when target temperature is
      // set to a value <10 (the minimal HomeKit value).
      if(value !== this.value) {
        this.value = value;
        this.service.updateCharacteristic(characteristic, this.value);
      }
       
    }
  }

}

//-------------------------------------------------------------------------------------------------
// Miele Target Temperature Characteristic
//-------------------------------------------------------------------------------------------------
export class MieleTargetTempCharacteristic extends MieleTempCharacteristic {  

  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
    private serialNumber: string,
    offTemp: number,
  ) {
    super(platform, service, TemperatureType.Target, offTemp);
  }

  //-------------------------------------------------------------------------------------------------
  // Set
  async set(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    callback(null);

    this.platform.log.debug(`Set characteristic "${TemperatureType[this.type]} temperature" to: ${value}`);

    try {
      const response = await axios.put(this.platform.getActionsUrl(this.serialNumber),
        {targetTemperature:
          [{zone:this.DEFAULT_ZONE, value: value}], // Setting is done in Celsius, retrieving returns centi-Celsius.
        }, this.platform.getHttpRequestConfig());

      this.platform.log.debug(`Set target temperature response code: ${response.status}: "${response.statusText}"`);

    } catch(response) {
      if(response.response && response.response.status === 500) {
        this.platform.log.warn(`Set target temperature: ignoring Miele API fault reply code ${response.response.status}. `+
          'Device most probably still acknowlegded (known Miele API misbehaviour).');
      } else {
        this.platform.log.error( createErrorString(response) );
        // TODO: This characteristic needs to be added first.
        this.service.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.GENERAL_FAULT);
      }
    }
  }

}


//-------------------------------------------------------------------------------------------------
// Miele Temperature Unit Characteristic
//-------------------------------------------------------------------------------------------------
export class MieleTemperatureUnitCharacteristic extends MieleReadOnlyCharacteristic {

  constructor(
    platform: MieleAtHomePlatform,
    service: Service,
  ) {
    super(platform, service, platform.Characteristic.TemperatureDisplayUnits.CELSIUS);
  }

  //-------------------------------------------------------------------------------------------------
  update(response: MieleStatusResponse): void {
    if(response.temperature[0].unit === 'Celsius' ) {
      this.value = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
    } else {
      this.value = this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
    }
    this.platform.log.debug(`Parsed Temperature Unit from API response: ${response.temperature[0].unit} (HomeKit value: ${this.value})`);
    this.service.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, this.value); 
  }

}
