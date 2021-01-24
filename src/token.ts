// Apacche License
// Copyright (c) 2021, Sander van Woensel

import 'node-persist';

import { TOKEN_STORAGE_NAME, TOKEN_REFRESH_CHECK_INTERVAL_S, REFRESH_TOKEN_URL } from './settings';
import { MieleAtHomePlatform } from './platform';
import NodePersist from 'node-persist';
import axios from 'axios';


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
    this.platform.log.debug('Creating new Token object');

    setInterval(() => {
      if(this.isNearlyExpired()) {
        this.refreshToken();
      } 
    }, TOKEN_REFRESH_CHECK_INTERVAL_S*1000);

  }

  //-------------------------------------------------------------------------------------------------
  private async refreshToken() {
    // Check required parameters.
    if(!this.platform.config.clientSecret || !this.platform.config.clienID) {
      this.platform.log.warn('Configuration parameters "clientID" or "clientSecret" is left empty. '+
        'Token will not be auto refreshed and will expire soon. Configure these settings or manually refresh the token.');
      return;
    }

    if(!this.tokenData.refresh_token) {
      this.platform.log.warn('No valid refresh token known. Token will not be auto refreshed and will expire soon.');
      return;
    }

    const params = {
      client_id: this.platform.config.clienID,
      client_secret: this.platform.config.clientSecret,
      refresh_token: this.tokenData.refresh_token,
      grant_type: Token.GRANT_TYPE,
    };

    const config = {
      'headers': { 
        'Authorization': this.getToken(),
        'Content-Type': 'application/x-www-form-urlencode',
      },
    };

    try {
      this.platform.log.info('Refreshing token...');
      const response = await axios.post(REFRESH_TOKEN_URL, params, config);
      this.platform.log.debug(`Token refresh response: ${response}`);
      this.tokenData = response.data;
      this.tokenData.creation_date = new Date();
      
      NodePersist.setItem(TOKEN_STORAGE_NAME, this.tokenData);
    } catch(response) {
      if(response.config && response.response) {
        this.platform.log.error(`Miele API request ${response.config.url} failed with status ${response.response.status}: `+
                                `"${response.response.statusText}".`);
      } else {
        this.platform.log.error(response);
      }
    }

  }

  //-------------------------------------------------------------------------------------------------
  private isNearlyExpired(): boolean {
    const expiredDate = new Date(this.tokenData.creation_date);
    expiredDate.setSeconds(expiredDate.getSeconds() + this.tokenData.expires_in);

    // One refresh check interval before real expiration.
    const currentDate = new Date();
    currentDate.setSeconds(currentDate.getSeconds() - TOKEN_REFRESH_CHECK_INTERVAL_S);

    this.platform.log.debug(`Current date: ${currentDate} >= Expired Date ${expiredDate}`);
    return currentDate >= expiredDate;
  }

  //-------------------------------------------------------------------------------------------------
  public getToken() : string {
    return 'Bearer '+this.tokenData.access_token;
  }

  //-------------------------------------------------------------------------------------------------
  static async construct(platform: MieleAtHomePlatform) : Promise<Token> {
    if(!Token.instance) {      
      // Attempt to load token from disk.
      await NodePersist.init({'dir': platform.api.user.persistPath()});

      let tokenData = await NodePersist.getItem(TOKEN_STORAGE_NAME);
      if(tokenData) {
        platform.log.debug('Token exists on disk.');
      } else {
        platform.log.debug('No persistent token stored. Creating new from configuration.');
        // TODO: Temporary:
        // No token in persistent storage, get it from the configuration.
        // This is temporary until we create a setup to retrieve the token and store it to disk.
        tokenData = {
          access_token: platform.config.token,
          refresh_token: platform.config.refreshToken,
          expires_in: 3600, // Force quick refresh for token retrieved from config as we do not known when it was retrieved.
          creation_date: new Date(), // This is the best we can do as we do not know when it was really created.
        };

        NodePersist.setItem(TOKEN_STORAGE_NAME, tokenData);
      }
      
      return new Token(platform, tokenData);
    } else {
      return Token.instance;
    }
  }
}
  
