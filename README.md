![Build and Lint](https://github.com/QuickSander/homebridge-mieleathome/workflows/Build%20and%20Lint/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![npm version](https://badge.fury.io/js/homebridge-mieleathome.svg)](https://badge.fury.io/js/homebridge-mieleathome)

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

## Features
- Easy setup: guided process to retrieve token via OAuth2 from Miele.
- Automatic token refreshing.
- Start / stop (dish) washing machine program (with an option to disable to prevent unintentional program stop requests).
- Remaining run time of last hour.
- Washing machine / dish washer program target temperature.
- HomeKit identify support via Homebridge log.

## Breaking changes
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
- A HomeKit valve has a maximum remaining duration of 3600 seconds. The washing machine's remaining duration will thus only reflect the real
  remaining duration as reported by your Miele device when the duration decreases to a value less than 3600 seconds.
- A HomeKit valve can be turned on and off, however Miele's 3rd party Web API does not always allow you to turn on or off the washing 
  machine. Flipping the switch when not allowed will revert the switch state when it is not allowed.

## Further reading
- [Wiki](../../wiki/)

## Planned features
- Add support for fridges, ovens and hobs.
- Add Custom characteristic to display current program running.

## Thanks
- [MichelRabozee](https://github.com/MichelRabozee)
