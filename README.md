![Build and Lint](https://github.com/QuickSander/homebridge-mieleathome/workflows/Build%20and%20Lint/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![npm version](https://badge.fury.io/js/homebridge-mieleathome.svg)](https://badge.fury.io/js/homebridge-mieleathome)

![Miele](https://media.miele.com/media/miele_com/media/miele-logo-immer-besser.png "Miele - Immer besser")


# Miele@home Homebridge plugin

This [Homebridge](https://homebridge.io) plugin strives to integrate Miele@home enabled devices with HomeKit.
It (currently) requires a
+ [Miele@mobile](http://www.miele.com) account to obtain a client id and secret, and a;
+ [Miele Developer](http://www.miele.com/developer) account.

_This plugin is in its infancy,_ but functional and actively updated.

## Supported Devices
- Miele Ventilation Hood (credits: [talsalis](https://github.com/talsalis/homebridge-miele-hood)).
- Miele Washer Dryer Combination or stand alone Washer (e.g. WTZH730, WCG370, and more). Emaulated as a water valve. See [Limitations](#limitations)

## Getting started

### Method 1: Command line / efficient
1. Create a [Miele@mobile](http://www.miele.com) account if you do not already have one.
2. Autheticate this plugin via the following link where you have replaced the client ID with the client ID you obtained when requesting the Miele developer account. `https://api.mcs3.miele.com/thirdparty/login?client_id=`_your client id_`&response_type=code&redirect_uri=http://www.example.com:8592&state=1`
3. After succesfull authorization, the browser will redirect you to something like: `http://www.example.com:8592/?code=NL_74f14379695a6019bdf8d6bccb9f702c&state=1`. Copy only the code after `code=`.
4. In a terminal execute: `curl -X POST -d client_id=`_your client id_` -d grant_type=authorization_code -d redirect_uri=http://cerebros.local:8592 -d vg=nl-NL -d client_secret=`_your secret_` -d code=`_copied code from previous step_` https://api.mcs3.miele.com/thirdparty/token`
5. Your token will be returned by the authorization server. This token can be stored in the plugin configuration.

### Method 2: Browser only / easy but more time consuming
1. Create a [Miele@mobile](http://www.miele.com) account if you do not already have one.
1. Request a Miele developer account / Client ID / Client Secret via the [Get Involved](https://www.miele.com/f/com/en/register_api.aspx) section.
2. To get the authentication token go to the [Swagger page](https://www.miele.com/developer/swagger-ui/swagger.html) and authorize using your developer ClientID and ClientSecret.
3. After automatic redirection, login with your Miele@Mobile user credentials.
4. In the [Swagger page](https://www.miele.com/developer/swagger-ui/swagger.html), issue a `/devices` request by clicking "try it out".
5. The page will display your token in the curl example request: `curl -X GET "https://api.mcs3.miele.com/v1/devices?language=en" -H "accept: application/json; charset=utf-8" -H "Authorization: Bearer `_token_`"`
6. Save the token identifier and store it in the plugin configuration's `token` property.

## Limitations

Washer Dryer / Washer / Dishwasher:
- HomeKit does not support a washer dryer / washing machine or dish washer. It will be emulated as a valve.
- A HomeKit valve has a maximum remaining duration of 3600 seconds. The washing machine's remaining duration will thus only reflect the real
  remaining duration as reported by your Miele device when the duration decreases to a value less than 3600 seconds.
- A HomeKit valve can be turned on and off, however Miele's 3rd party Web API does not allow you to turn _on_ the washing machine. 
  Switching it of will result in issueing a stop command towards the washing machine when its state allows it.

## Planned features
- Automatic token retrieval and refreshing using user provided ClientID and ClientSecret.

## Thanks
- [MichelRabozee](https://github.com/MichelRabozee)
