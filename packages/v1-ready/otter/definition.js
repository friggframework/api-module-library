require('dotenv').config();
const crypto = require('crypto');
const { get } = require('@friggframework/core');
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
        setAuthParams: async function (api, params) {
            // The form submits the user-entered API token; rehydrate the api
            // client exactly as its constructor does — store the raw token and
            // set the Authorization header value to `Bearer <token>`, stripping
            // any pre-existing "Bearer " prefix so it is never doubled.
            const raw = (
                get(params, 'api_token', null) ||
                get(params, 'api_key', null) ||
                ''
            ).replace(/^Bearer\s+/i, '');
            if (raw) {
                api.api_token = raw;
                api.setApiKey('Bearer ' + raw);
            }
        },
        getAuthorizationRequirements: async function (api) {
            return api.getAuthorizationRequirements();
        },
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
