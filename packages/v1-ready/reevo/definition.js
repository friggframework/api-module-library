require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

// Reevo issues a static API key (no OAuth), so there is no external account id
// returned at auth time. We derive a stable, non-reversible identifier from the
// key itself so the same key always maps to the same entity/credential.
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Reevo',
    requiredAuthMethods: {
        setAuthParams: async function (api, params) {},
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            return {
                identifiers: { externalId: keyFingerprint(api.api_key), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: { externalId: keyFingerprint(api.api_key), userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.REEVO_API_KEY,
    },
};

module.exports = { Definition };
