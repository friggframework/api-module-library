require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

// Amplitude issues a static project API key + secret (Basic auth, no OAuth),
// so there is no external account id returned at auth time. We derive a stable,
// non-reversible identifier from the API key so the same credentials always
// map to the same entity/credential.
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Amplitude',
    // ADR-057: canonical mapping lives on extensions.mapping (see index.js).
    mappings: { business: 'extensions.mapping' },
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(data, 'api_key', null) ||
                get(data, 'apiKey', null);
            const secretKey =
                get(params, 'secret_key', null) ||
                get(params, 'secretKey', null) ||
                get(params, 'api_secret', null) ||
                get(data, 'secret_key', null) ||
                get(data, 'secretKey', null) ||
                get(data, 'api_secret', null);
            const region =
                get(params, 'region', null) || get(data, 'region', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(data, 'base_url', null) ||
                get(data, 'baseUrl', null);
            const profileBaseUrl =
                get(params, 'profile_base_url', null) ||
                get(params, 'profileBaseUrl', null) ||
                get(data, 'profile_base_url', null) ||
                get(data, 'profileBaseUrl', null);

            if (apiKey) {
                api.api_key = apiKey;
                api.username = apiKey;
            }
            if (secretKey) {
                api.secret_key = secretKey;
                api.password = secretKey;
            }
            if (region) {
                api.setRegion(region);
            }
            if (baseUrl) {
                api.setBaseUrl(baseUrl);
            }
            if (profileBaseUrl) {
                api.profileBaseUrl = profileBaseUrl;
            }
            return api;
        },

        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.api_key || api.username),
                    userId,
                },
                details: {
                    region: api.region,
                    baseUrl: api.baseUrl,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'api_key',
                'secret_key',
                'region',
                'base_url',
                'profile_base_url',
            ],
            entity: [],
        },

        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.api_key || api.username),
                    userId,
                },
                details: {
                    region: api.region,
                    baseUrl: api.baseUrl,
                },
            };
        },

        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.AMPLITUDE_API_KEY,
        secret_key: process.env.AMPLITUDE_SECRET_KEY,
        region: process.env.AMPLITUDE_REGION,
        base_url: process.env.AMPLITUDE_BASE_URL,
        profile_base_url: process.env.AMPLITUDE_PROFILE_BASE_URL,
    },
};

module.exports = { Definition };
