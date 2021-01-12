import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MieleHoodPlatformAccessory } from './mieleHoodPlatformAccessory';
import { MieleWasherDryerPlatformAccessory } from './mieleWasherDryerPlatformAccessory';

import request from 'request';

//-------------------------------------------------------------------------------------------------
// Main class
export class MieleAtHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public readonly token = 'Bearer ' + this.config.token;
  public readonly pollInterval: number = parseInt(<string>this.config.pollInterval);
  public readonly baseURL = 'https://api.mcs3.miele.com/v1/devices';

  
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
  // Discover devices
  private discoverDevices() {

    const config = {
      'method': 'GET',
      'url': this.baseURL,
      'headers': { 
        'Authorization': this.token,
        'Content-Type': 'application/json',
      },
    };

    request(config, (err, res, body) => {
      if (err) {
        return(this.log.debug(err));
      }
      const response = JSON.parse(body);
      this.log.debug('Platform::discoverDevices: ', response);

      const allDevices = Object.keys(response).map(key => response[key]);

      // Loop over the discovered devices and register each one if it has not already been registered
      for (const device of allDevices) {

        const deviceObject = {
          uniqueId: device.ident.deviceIdentLabel.fabNumber,
          displayName: device.ident.deviceName || device.ident.type.value_localized,
          modelNumber: device.ident.deviceIdentLabel.techType,
        };

        this.log.info(`Discovered device: id: ${deviceObject.uniqueId}, `+
                      `name: ${deviceObject.displayName}, model: ${deviceObject.modelNumber}`);

        // Determine device type
        let platformAccessoryType;

        switch (device.ident.type.value_raw) {
          case this.HOOD_RAW_ID: {
            platformAccessoryType = MieleHoodPlatformAccessory;
            break;
          }

          case this.WASHER_DRYER_ID:
          case this.WASHER_ID: {
            platformAccessoryType = MieleWasherDryerPlatformAccessory;
            break;
          }
          
          default: {
            this.log.info(`Skipping unsupported device "${deviceObject.displayName}" `+
                          `with raw type value: ${device.ident.type.value_raw}.`);
            return;
            break;
          }
          
        }

        // Generate a unique id for the accessory.
        const uuid = this.api.hap.uuid.generate(deviceObject.uniqueId);

        // See if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // The accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          // this.api.updatePlatformAccessories([existingAccessory]);

          new platformAccessoryType(this, existingAccessory,
            deviceObject.modelNumber,
            device.ident.xkmIdentLabel.releaseVersion,
            deviceObject.uniqueId);

        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', deviceObject.displayName);

          // create a new accessory
          const accessory = new this.api.platformAccessory(deviceObject.displayName, uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = deviceObject;

          new platformAccessoryType(this, accessory,
            deviceObject.modelNumber,
            device.ident.xkmIdentLabel.releaseVersion,
            deviceObject.uniqueId);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }



      }
    });
  }
}
