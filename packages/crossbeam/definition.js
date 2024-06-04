require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
  API: Api,
  getName: function () {
    return config.name;
  },
  moduleName: config.name,
  modelName: 'Crossbeam',
  requiredAuthMethods: {
    getToken: async function (api, params) {
      const code = get(params.data, 'code');
      return api.getTokenFromCode(code);
    },
    getEntityDetails: async function (
      api,
      callbackParams,
      tokenResponse,
      userId
    ) {
      const userDetails = await api.getUserDetails();
      return {
        identifiers: { externalId: userDetails.portalId, user: userId },
        details: { name: userDetails.hub_domain },
      };
    },
    apiPropertiesToPersist: {
      credential: ['access_token', 'refresh_token'],
      entity: [],
    },
    getCredentialDetails: async function (api, userId) {
      const userDetails = await api.getUserDetails();
      return {
        identifiers: { externalId: userDetails.portalId, user: userId },
        details: {},
      };
    },
    testAuthRequest: async function (api) {
      return api.getUserDetails();
    },
  },
  env: {
    client_id: process.env.CROSSBEAM_CLIENT_ID,
    client_secret: process.env.CROSSBEAM_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI,
    scopes: process.env.CROSSBEAM_SCOPES,
  },
};

module.exports = { Definition };
