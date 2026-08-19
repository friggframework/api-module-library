require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

// Otter issues a static API key (Bearer token, no OAuth), so there is no
// external account id returned at auth time. We derive a stable, non-reversible
// identifier from the raw token so the same key always maps to the same
// entity/credential.
const keyFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Otter',
    requiredAuthMethods: {
        setAuthParams: async function (api, params) {},
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.api_token),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.api_token),
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        api_token: process.env.OTTER_API_KEY,
    },
};

module.exports = { Definition };
