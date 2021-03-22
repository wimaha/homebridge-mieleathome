// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { PlatformAccessory, CharacteristicSetCallback, Service, CharacteristicValue } from 'homebridge';

import { DEVICES_INFO_URL, EVENT_SERVER_RECONNECT_DELAY_S, DEFAULT_RECONNECT_EVENT_SERVER_INTERVAL_MIN } from './settings';
import { MieleAtHomePlatform } from './platform';
import { IMieleCharacteristic } from './mieleCharacteristics';

import EventSource from 'eventsource';

export enum MieleState {
  Off = 1,
  ProgramSelected = 3,
  WaitingToStart = 4,
  InUse = 5,
  Finished = 7,
  Cancelled = 9,
}

//-------------------------------------------------------------------------------------------------
// Interface Miele status response
//-------------------------------------------------------------------------------------------------
export interface MieleStatusResponseTemp {
  value_raw: number; value_localized: null|string; unit: string;
}

export interface MieleStatusResponse {
  status: {value_raw: number};
  programPhase: {value_raw: number};
  remainingTime: number[];
  temperature: MieleStatusResponseTemp[];
  targetTemperature: MieleStatusResponseTemp[];
}

//-------------------------------------------------------------------------------------------------
// Class Base Miele Accessory
//-------------------------------------------------------------------------------------------------
export abstract class MieleBasePlatformAccessory {
  private eventUrl = DEVICES_INFO_URL + '/' + this.accessory.context.device.uniqueId + '/events';
  protected mainService!: Service;
  protected characteristics: IMieleCharacteristic[] = [];
  private eventSource: EventSource | null = null;
  static connectionDelayMs = 100;

  //-------------------------------------------------------------------------------------------------
  constructor(
    protected readonly platform: MieleAtHomePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    this.platform.log.debug(`${this.accessory.context.device.displayName}: Device connection delay:`,
      `${MieleBasePlatformAccessory.connectionDelayMs}[ms]`);

    // Set accessory information.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Miele')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.modelNumber)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareRevision)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uniqueId)
      .getCharacteristic(this.platform.Characteristic.Identify)
      .on('set', this.identify.bind(this));

    // Prevent connecting all devices at the same time.
    setTimeout(this.connectToEventServer.bind(this), MieleBasePlatformAccessory.connectionDelayMs);

    let reconnectTimeout = this.platform.reconnectEventServerInterval;
    if(this.platform.reconnectEventServerInterval <=0) {
      this.platform.log.warn('Incorrect \'reconnectEventServerInterval\' specified in your configuration. '+
        `Value: ${reconnectTimeout} should be >0. Using default value ${DEFAULT_RECONNECT_EVENT_SERVER_INTERVAL_MIN}[min] instead.`);
      reconnectTimeout = DEFAULT_RECONNECT_EVENT_SERVER_INTERVAL_MIN;
    }

    const reconnectTimeoutMs= (reconnectTimeout*60*1000)+MieleBasePlatformAccessory.connectionDelayMs;
    setInterval(this.connectToEventServer.bind(this), reconnectTimeoutMs);

    // Next device will add an additional 1s delay.
    MieleBasePlatformAccessory.connectionDelayMs += 1000;

  }

  //-----------------------------------------------------------------------------------------------
  private connectToEventServer() {
    // Close previous
    if(this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const config = this.platform.getHttpRequestConfig();
    config.headers['Authorization'] = this.platform.token?.getAccessToken();
    config.headers['Accept'] = 'text/event-stream';

    this.eventSource = new EventSource(this.eventUrl, config);

    this.eventSource.addEventListener('device', (event) => {
      this.platform.log.debug(`${this.accessory.context.device.displayName}: Event '${event.type}' received.`);
      const data = JSON.parse(event['data']);
      this.update(data.state);
    });

    this.eventSource.onopen = (_message) => {
      this.platform.log.info(`${this.accessory.context.device.displayName}: `+
        'Connection with Miele event server succesfully (re-)established.');
    };

    this.eventSource.addEventListener('ping', (event) => {
      this.platform.log.debug(`${this.accessory.context.device.displayName}: Event '${event.type}' received.`);
    });

    this.eventSource.onerror = (error) => {
      this.eventSource?.close();
      this.platform.log.error(`${this.accessory.context.device.displayName}: Error received from Miele event server: `+
        `'${JSON.stringify(error)}'`);
      this.mainService.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.GENERAL_FAULT);

      const reconnectLdeayMs = MieleBasePlatformAccessory.connectionDelayMs + EVENT_SERVER_RECONNECT_DELAY_S*1000;

      this.platform.log.info(`${this.accessory.context.device.displayName}: Will attempt to reconnect to the Miele event server after`+
        ` ${reconnectLdeayMs/1000}[s].`);
      setTimeout(()=> {
        this.connectToEventServer();
      }, reconnectLdeayMs);
    };

  }

  //-----------------------------------------------------------------------------------------------
  protected identify(_value: CharacteristicValue, _callback: CharacteristicSetCallback) {
    this.platform.log.info(`Identify requested for: ${this.accessory.context.device.displayName} `+
      `(${this.accessory.context.device.modelNumber}) `+
      `with serial number: ${this.accessory.context.device.uniqueId}`);
  }

  //-----------------------------------------------------------------------------------------------
  // Update all characteristics
  protected update(deviceData: MieleStatusResponse): void {
    for(const characteristic of this.characteristics) {
      characteristic.update(deviceData);
    }

    this.mainService.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT);
    
  }

}
