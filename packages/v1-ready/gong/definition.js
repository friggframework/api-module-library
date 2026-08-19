require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

// Gong issues a static Access Key + Secret (Basic auth, no OAuth), so there is
// no external account id returned at auth time. We derive a stable,
// non-reversible identifier from the access key so the same credentials always
// map to the same entity/credential.
const keyFingerprint = (accessKey) =>
    crypto.createHash('sha256').update(String(accessKey)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Gong',
    requiredAuthMethods: {
        // Renders the interactive CLI / hosted auth form for this Basic-auth
        // (API-key style) module. Delegates to the Api class definition.
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        // On the auth callback the user-entered Access Key + Secret arrive in
        // `params` (flat or nested under `params.data`). Wire them onto the
        // BasicAuthRequester so the Base64(accessKey:accessKeySecret) header is
        // built for testAuthRequest and every subsequent call. Without this the
        // form credentials are silently dropped and requests run unauthenticated.
        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const accessKey =
                get(params, 'access_key', null) ||
                get(data, 'access_key', null);
            const accessKeySecret =
                get(params, 'access_key_secret', null) ||
                get(data, 'access_key_secret', null);

            if (accessKey) {
                api.access_key = accessKey;
                api.username = accessKey;
            }
            if (accessKeySecret) {
                api.access_key_secret = accessKeySecret;
                api.password = accessKeySecret;
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
                    externalId: keyFingerprint(api.access_key || api.username),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_key', 'access_key_secret'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {
                    externalId: keyFingerprint(api.access_key || api.username),
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
        access_key: process.env.GONG_ACCESS_KEY,
        access_key_secret: process.env.GONG_ACCESS_KEY_SECRET,
        base_url: process.env.GONG_BASE_URL,
    },
};

module.exports = { Definition };
