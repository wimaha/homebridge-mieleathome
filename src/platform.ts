// Apacche License
// Copyright (c) 2020, Sander van Woensel

import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MieleHoodPlatformAccessory } from './mieleHoodPlatformAccessory';
import { MieleWasherDryerPlatformAccessory } from './mieleWasherDryerPlatformAccessory';

import axios from 'axios';

//-------------------------------------------------------------------------------------------------
// Class MieleAtHomePlatform
//-------------------------------------------------------------------------------------------------
export class MieleAtHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public readonly token = 'Bearer ' + this.config.token;
  public readonly pollInterval: number = parseInt(<string>this.config.pollInterval);
  public readonly baseURL = 'https://api.mcs3.miele.com/v1/devices';

  // Readonly constants
  public readonly WASHER_ID = 1;
  public readonly DISH_WASHER_ID = 7;
  public readonly HOOD_RAW_ID = 18;
  public readonly WASHER_DRYER_ID = 24;


  //-----------------------------------------------------------------------------------------------
  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      
      if (!this.token || this.token==='') {
        this.log.info('No token known.');
      } else {
        this.discoverDevices();
      }
    });
  }

  //-----------------------------------------------------------------------------------------------
  // This function is invoked when homebridge restores cached accessories from disk at startup.
  // It should be used to setup event handlers for characteristics and update respective values.
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // Add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  //-----------------------------------------------------------------------------------------------
  // Discover devices from Miele web API and construct supproted devices.
  private async discoverDevices() {

    const config = {
      'headers': { 
        'Authorization': this.token,
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await axios.get(this.baseURL, config);
      this.log.debug('Discovered devices: ', response.data);
      const allDevices = Object.keys(response.data).map(key => response.data[key]);

      // Loop over the discovered devices and register each one if it has not already been registered
      for (const device of allDevices) {

        const deviceObject = {
          uniqueId: device.ident.deviceIdentLabel.fabNumber,
          displayName: device.ident.deviceName || device.ident.type.value_localized,
          modelNumber: device.ident.deviceIdentLabel.techType,
        };

        this.log.info(`Discovered device: id: ${deviceObject.uniqueId}, `+
                      `name: ${deviceObject.displayName}, model: ${deviceObject.modelNumber}`);

        // Generate a unique id for the accessory.
        const uuid = this.api.hap.uuid.generate(deviceObject.uniqueId);

        // See if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // The accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          const accessoryObj = this.constructPlatformAccessory(device.ident.type.value_raw, existingAccessory,
            deviceObject.modelNumber,
            device.ident.xkmIdentLabel.releaseVersion,
            deviceObject.uniqueId);

          if(!accessoryObj) {
            this.log.info('Retrieved accessory from cache, but its raw type value is not a supported device. '+
                          `Device: "${deviceObject.displayName}" `+
                          `with raw type value: ${device.ident.type.value_raw}.`);
          }

        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', deviceObject.displayName);

          // Create a new accessory
          const accessory = new this.api.platformAccessory(deviceObject.displayName, uuid);

          // Store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = deviceObject;

          const accessoryObj = this.constructPlatformAccessory(device.ident.type.value_raw, accessory,
            deviceObject.modelNumber,
            device.ident.xkmIdentLabel.releaseVersion,
            deviceObject.uniqueId);

          if(accessoryObj) {
            // Link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          } else {
            this.log.info('Skipping unsupported device. '+
                          `Device: "${deviceObject.displayName}" `+
                          `with raw type value: ${device.ident.type.value_raw}.`);
          }
        }
      }

    } catch(response) {
      if(response.config && response.response) {
        this.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}".`);
      } else {
        this.log.error(response);
      }
    }
  }

  //-----------------------------------------------------------------------------------------------
  // Construct accessory
  private constructPlatformAccessory(raw_id: number, accessory: PlatformAccessory, 
    model: string, firmwareRevision: string, serialNumber: string) {

    switch (raw_id) {
      case this.HOOD_RAW_ID: {
        // TODO: Change to class deriving from BasePlatformAccessory.
        return new MieleHoodPlatformAccessory(this, accessory, model, serialNumber);
        break;
      }

      case this.WASHER_DRYER_ID:
      case this.WASHER_ID: {
        return new MieleWasherDryerPlatformAccessory(this, accessory, model, firmwareRevision, serialNumber);
        break;
      }
      
      default: {
        return null;
        break;
      }
      
    }
  }
}
