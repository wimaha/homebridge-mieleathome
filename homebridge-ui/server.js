// eslint-disable no-console

// Apacche License
// Copyright (c) 2021, Sander van Woensel

// TODO: Source token name and persist path from settings.ts?

const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');

const http = require('http');
const url = require('url');
const fs = require('fs');
const fsp = fs.promises;
const axios = require('axios');
const crypto = require("crypto");
const tokenStorage = require('node-persist');

const HOST = '0.0.0.0';

// Delay before sending token request after authorization grant has been received.
const REQUEST_TOKEN_DELAY_MS = 1000;
const MIELE_RESPONSE_TIMEOUT_MS = 1000*60*3;

const MESSAGE_BOX_FILE = __dirname + '/public/auth_grant.html';
const LOGO_FILE = __dirname + '/public/miele-homebridge.png';

// Token request URL
const TOKEN_REQUEST_URL = 'https://api.mcs3.miele.com/thirdparty/token/';

// PluginUiServer does not expose persist path yet.
const HOMEBRIDGE_PERSIST_PATH = 'persist';
const TOKEN_STORAGE_NAME = 'Miele@home.Token.json';



//-------------------------------------------------------------------------------------------------
// Class
//-------------------------------------------------------------------------------------------------
class PluginUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.server = null;
    this.expectedState = '';

    // Retrieve possibly existing tokens from disk.
    tokenStorage.initSync({'dir': this.homebridgeStoragePath+'/'+HOMEBRIDGE_PERSIST_PATH});

    this.onRequest('/is_token_stored', this.isTokenStored.bind(this));
    this.onRequest('/initialize_server', this.initializeAuthorizationGrantServer.bind(this));
    
    // This MUST be called when you are ready to accept requests.
    this.ready();

  }

  //-------------------------------------------------------------------------------------------------
  async writeHtmlMessage(res, code, title, message) {
    let htmlContent = (await fsp.readFile(MESSAGE_BOX_FILE)).toString();
    htmlContent = htmlContent.replace(/%%TITLE%%/g, title);
    htmlContent = htmlContent.replace(/%%MESSAGE%%/g, message);

    let type = 'Error';
    let typeStyle = 'danger';
    if(code===200) {
      type = 'Success';
      typeStyle = type.toLowerCase();
    } 
    htmlContent = htmlContent.replace(/%%TYPE%%/g, type);
    htmlContent = htmlContent.replace(/%%TYPE_STYLE%%/g, typeStyle);
    
    res.writeHead(code, {'Content-Type': 'text/html'});
    res.end(htmlContent);
  }

  //-------------------------------------------------------------------------------------------------
  validateAuthorizationGrant(res, qParams) {
    let success = false;

    // Serve main content and parse request.
    if(!qParams.has('code') || qParams.get('code') === '') {
      this.writeHtmlMessage(res, 501, 'Authorization grant invalid', 'No valid authorization grant code received.');
      this.pushEvent('token-status-changed', 'error');
    } else if(qParams.has('state') && qParams.get('state') !== this.expectedState) {
      this.writeHtmlMessage(res, 502, 'Malformed authorization grant received',
        `Received state does not equal expected state. Received state: "${qParams.state}".`);
      this.pushEvent('token-status-changed', 'error');
    } else {
      console.log('Raising token-status-changed event');
      this.pushEvent('token-status-changed', 'authorization_grant_received');

      this.writeHtmlMessage(res, 200, 'Authorization grant succesfully received.', 'You may close this window.');
      success = true;
    }

    return success;
  }

  //-------------------------------------------------------------------------------------------------
  authorizationGrantListener(req, res) {
    console.log(`Received request: http://${req.headers.host}${req.url}`);
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    switch(reqUrl.pathname) { 
      case '/auth_grant':
        if(this.validateAuthorizationGrant(res, reqUrl.searchParams)) {
          // Store URI to send back to Miele which verifies this URI is identical to the one provided earlier from index.html
          // when the authorization grant was initiated.
          setTimeout(this.requestToken.bind(this, reqUrl.searchParams.get('code'), req.headers.host), REQUEST_TOKEN_DELAY_MS);
        }
        break;

      case '/image': {
        let stream = fs.createReadStream(LOGO_FILE);
        res.writeHead(200, {'Content-Type': 'image/png'});
        stream.pipe(res);
        break;
      }

      default:
        this.writeHtmlMessage(res, 404, 'Invalid request', `Resource "${reqUrl.pathname}" not found.`);
        break;
    }
    
  }

  //-------------------------------------------------------------------------------------------------
  async initializeAuthorizationGrantServer(options) {

    // Always update credentials since this event can be fired multiple times.
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;

    if(this.mieleResponseTimeout) {
      clearTimeout(this.mieleResponseTimeout);
    }
    this.mieleResponseTimeout = setTimeout(() => {
      this.pushEvent('error', {message: 'Timeout waiting '+(MIELE_RESPONSE_TIMEOUT_MS/1000/60)+
        'min for Miele server to respond with authorization grant.', title: 'Timeout'});
    }, MIELE_RESPONSE_TIMEOUT_MS);

    // If server is already running, do not restart it.
    if(!this.server || this.port !== options.port) {
      if(this.server) {
        console.log('Closing previous authorization receiver server.');
        this.server.close();
      }
      this.server = http.createServer(this.authorizationGrantListener.bind(this));
      this.server.listen(options.port, HOST, () => {
        console.log(`Temporary authorization grant receiver server running on http://${HOST}:${options.port}`);
      });
      this.port = options.port;

      this.generateState();
    }

    return this.expectedState;
  }

  //-------------------------------------------------------------------------------------------------
  async isTokenStored(_) {
    
    let tokenData = tokenStorage.getItem(TOKEN_STORAGE_NAME);

    if (tokenData && tokenData.access_token && tokenData.refresh_token && tokenData.creation_date && tokenData.expires_in) {
      console.log('Valid token already available in persistent storage.');
      return true;
    } 

    console.log('No valid token in persistent storage. Setup required. Token in storage: '+JSON.stringify(tokenData));
    return false;
  }

  //-------------------------------------------------------------------------------------------------
  async generateState() {
    this.expectedState = crypto.randomBytes(16).toString('hex');
    console.log('Generated state: '+this.expectedState);
  }

  //-------------------------------------------------------------------------------------------------
  // Final step, called after authorization grant returned.
  async requestToken(authorizationCode, authorizationGrantHost) {
    
    // Post parameters.
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', `http://${authorizationGrantHost}/auth_grant`);
    params.append('vg', 'nl-NL'); // TODO: This should actually be macthing clientID/secret registration country.
    params.append('code', authorizationCode);
    // Redact client secret in log.
    console.log('Token request post params: '+params.toString().replace(/client_secret=.*&grant_type/, 'client_secret=****&grant_type'));

    const config = {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json;charset=utf-8',
      },
    };

    try {
      // Retrieve token.
      const response = await axios.post(TOKEN_REQUEST_URL, params, config);
      //console.log('Token request response: '+JSON.stringify(response.data)); // Cannot print. Contains sensitive data.
      this.pushEvent('token-status-changed', 'token_received');

      let tokenData = response.data;
      tokenData.creation_date = new Date();

      tokenStorage.setItem(TOKEN_STORAGE_NAME, tokenData);
      this.pushEvent('token-status-changed', 'token_stored');

    } catch(err) {
      console.log('Request token error: '+err.message);
      this.pushEvent('error', {message: err.message, title: 'Failed to request token'});
    } finally {
      if(this.mieleResponseTimeout) {
        clearTimeout(this.mieleResponseTimeout);
      }
    }
  }

}

(() => {
  return new PluginUiServer();
})();