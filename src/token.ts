// Apache License
// Copyright (c) 2021, Sander van Woensel

import { TOKEN_STORAGE_NAME, TOKEN_REFRESH_CHECK_INTERVAL_S, REFRESH_TOKEN_URL } from './settings';
import { MieleAtHomePlatform } from './platform';
import nodePersist from 'node-persist';
import axios from 'axios';
import { URLSearchParams } from 'url';


//-------------------------------------------------------------------------------------------------
// Interface Token Data
//-------------------------------------------------------------------------------------------------
export interface ITokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  creation_date: Date;
}

//-------------------------------------------------------------------------------------------------
// Token. 
//-------------------------------------------------------------------------------------------------
export class Token {
      
  private static instance: Token;
  private static readonly GRANT_TYPE = 'refresh_token';

  //-------------------------------------------------------------------------------------------------
  private constructor(
      private platform: MieleAtHomePlatform,
      private tokenData: ITokenData,
  ) {
    setInterval(() => {
      if(this.isNearlyExpired()) {
        this.refreshToken();
      } 
    }, TOKEN_REFRESH_CHECK_INTERVAL_S*1000);

  }

  //-------------------------------------------------------------------------------------------------
  private async refreshToken() {
    // Check required parameters.
    if(!this.platform.config.clientSecret || !this.platform.config.clientID) {
      this.platform.log.warn('Configuration parameters "clientID" or "clientSecret" is left empty. '+
        'Token will not be auto refreshed and will expire soon. Configure these settings or manually refresh the token.');
      return;
    }

    if(!this.tokenData.refresh_token) {
      this.platform.log.warn('No valid refresh token known. Token will not be auto refreshed '+
        'and will expire soon.');
      return;
    }

    // Post parameters.
    const params = new URLSearchParams();
    params.append('client_id', <string>this.platform.config.clientID);
    params.append('client_secret', <string>this.platform.config.clientSecret);
    params.append('refresh_token', this.tokenData.refresh_token);
    params.append('grant_type', Token.GRANT_TYPE);

    const config = {
      headers: { 
        'Authorization': this.getAccessToken(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json;charset=utf-8',
      },
    };

    try {
      this.platform.log.info('Refreshing token...');
      const response = await axios.post(REFRESH_TOKEN_URL, params, config);
      this.platform.log.debug(`Token refresh response: ${JSON.stringify(response.data)}`);
      this.tokenData = response.data;
      this.tokenData.creation_date = new Date();
      
      nodePersist.setItem(TOKEN_STORAGE_NAME, this.tokenData);
      this.platform.log.info('Token succesfully refreshed and saved in persistent storage.');
    } catch(response) {
      if(response.config && response.response) {
        this.platform.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}"`);
      } else {
        this.platform.log.error(response);
      }

    }

  }

  //-------------------------------------------------------------------------------------------------
  private isNearlyExpired(): boolean {
    const expiredDate = new Date(this.tokenData.creation_date);
    expiredDate.setSeconds(expiredDate.getSeconds() + this.tokenData.expires_in);

    // One refresh check interval before real expiration to provide some margin
    // for the actual refresh.
    // expiredDate = 12:00; currentDate = 11:50; TOKEN_REFRESH_CHECK_INTERVAL = 00:10
    // currentDate = 11:50 + 00:10 = 12:00 => expired!
    const currentDate = new Date();
    currentDate.setSeconds(currentDate.getSeconds() + TOKEN_REFRESH_CHECK_INTERVAL_S);

    const expired = currentDate >= expiredDate;
    this.platform.log.debug(`Current: ${currentDate} >= Expires ${expiredDate}? = ${expired}.`);
    return expired;
  }

  //-------------------------------------------------------------------------------------------------
  public getAccessToken() : string {
    return 'Bearer '+this.tokenData.access_token;
  }

  //-------------------------------------------------------------------------------------------------
  static async construct(platform: MieleAtHomePlatform) : Promise<Token> {
    if(!Token.instance) {      
      // Attempt to load token from disk.
      //await NodePersist.init({'dir': platform.api.user.persistPath()});
      nodePersist.initSync({'dir': platform.api.user.persistPath()});

      //let tokenData = await NodePersist.getItem(TOKEN_STORAGE_NAME);
      let tokenData = nodePersist.getItem(TOKEN_STORAGE_NAME);
      platform.log.debug('tokenData: '+JSON.stringify(tokenData));

      if(tokenData && tokenData.access_token && tokenData.refresh_token ) {
        platform.log.info('Token loaded from persistent storage.');
      } else {
        if(!platform.config.token) {
          platform.log.error('No *valid* token present in persistent storage. '+
            'Nor is there a "token" configured in the configuration. '+
            'Please re-setup this plugin.');
        } else {
          platform.log.error('No *valid* token present in persistent storage. '+
            'Will attempt to use the token from the configuration as a last resort. '+
            'Please re-setup this plugin.');
        }

        // Attempt to use token from configuration as last resort.
        // If one of the fields is invalid, this will be detected later.
        tokenData = {
          access_token: platform.config.token,
          refresh_token: platform.config.refreshToken,
          expires_in: 3600, // Force quick refresh for token retrieved from config as we do not known when it was retrieved.
          creation_date: new Date(), // This is the best we can do as we do not know when it was really created.
        };

        nodePersist.setItem(TOKEN_STORAGE_NAME, tokenData);
      }
      
      return new Token(platform, tokenData);
    } else {
      return Token.instance;
    }
  }
}
  
