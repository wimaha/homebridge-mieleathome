[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
![Build and Lint](https://github.com/QuickSander/homebridge-mieleathome/workflows/Build%20and%20Lint/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![npm (beta))](https://img.shields.io/npm/v/homebridge-mieleathome/beta.svg)](https://www.npmjs.com/package/homebridge-mieleathome)
[![npm (latest)](https://img.shields.io/npm/v/homebridge-mieleathome/latest)](https://www.npmjs.com/package/homebridge-mieleathome)

![Miele + Homebridge](./homebridge-ui/public/miele-homebridge.png "Miele + Homebridge")

# Miele@home Homebridge plugin

This [Homebridge](https://homebridge.io) plugin strives to integrate Miele@home enabled devices with HomeKit.
It (currently) requires a
+ [Miele@mobile](http://www.miele.com) account to obtain a client id and secret, and a;
+ [Miele Developer](http://www.miele.com/developer) account.

## Supported Devices
- Miele Ventilation Hood (credits: [talsalis](https://github.com/talsalis/homebridge-miele-hood)).
- Miele Washer Dryer Combination (e.g. WTZH730). 
- Miele Washing machine (e.g. WCG370, WMV960).
- Miele Dryer (e.g. TMV840WP)
- Miele Dishwasher.
- Miele Fridge.
- Miele Freezer (e.g. FN28263).
- MieleFridge Freezer combination.

## Features
- Easy setup: guided process to retrieve token via OAuth2 from Miele.
- Automatic token refreshing.
- Event based.
- Start / stop (dish) washing machine program (with an option to disable to prevent unintentional program stop requests).
- Remaining run time.
- Washing machine / dish washer program target temperature.
- Fridge / Freezer target and current temperature
- Set Fridge / Freezer target temperature.
- HomeKit identify support via Homebridge log.


## Breaking changes
### Versions > 2.8.0
- The introduction of event based updating removed the need for the _Poll interval_ setting. This option can be removed from
your config when you see a need to clean up your config.

### Versions > 2.5.2
- _Disable temperature sensor_ and _disable stop action ability_ need to be re-configured as the settings have become
finer grained (per specific device type instead of per group of device types).

### Versions >= 2.2.0
- Due to guided setup, `refreshToken` and `token` are no longer visible in the configuration UI. However if all fails,
  the plugin will still attempt to use these configuration settings as a last resort when they are configured in the `config.json`.

### Versions > v1.2.0
- `platform` name in your `config.json` should now be "Miele@home" instead of "MieleAtHome". If not you will receive: "_Error: The requested platform 'MieleAtHome' was not registered by any plugin._". Please mind the letter casing.
- `clientID`, `clientSecret` and `refreshToken` are now mandatory configuration parameters. If not supplied the plugin will continue to 
  function, but will lack the ability to auto refresh your token.

## Limitations

Washer Dryer / Washer / Dishwasher:
- HomeKit does not support a washer dryer, washing machine, tuble dryer  or dish washer. It will be emulated as a valve.
- A HomeKit valve can be turned on and off, however Miele's 3rd party Web API does not always allow you to turn on or off the washing 
  machine. Flipping the switch when not allowed will revert the switch state when it is not allowed.

Fridge / Freezer / Fridge Freezer combination:
- No multi-zone support (only the first zone controllable).

## Further reading
- [Wiki](../../wiki/)

## Planned features
- Add support for oven, hob and coffee machine?
- Add Custom characteristic to display current program running.

## Thanks
- [MichelRabozee](https://github.com/MichelRabozee)
