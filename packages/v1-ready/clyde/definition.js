require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Clyde issues a static Client Key + Secret (HTTP Basic, no OAuth) and has
 * no dedicated identity/"me" endpoint on the public REST API. We derive a
 * stable, non-reversible identifier from the client key so the same
 * credentials always map to the same entity/credential — same pattern as
 * Gong / Fathom key fingerprinting.
 */
const keyFingerprint = (clientKey) =>
    crypto.createHash('sha256').update(String(clientKey)).digest('hex');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Clyde',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientKey =
                get(params, 'clientKey', null) ||
                get(params, 'client_key', null) ||
                get(data, 'clientKey', null) ||
                get(data, 'client_key', null);
            const secret =
                get(params, 'secret', null) || get(data, 'secret', null);

            if (clientKey) {
                api.setClientKey(clientKey);
            }
            if (secret) {
                api.setSecret(secret);
            }
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const clientKey = api.clientKey || api.username;
            if (!clientKey) {
                throw new Error(
                    'Clyde: cannot derive a stable account identity — no clientKey to fingerprint.'
                );
            }
            return {
                identifiers: {
                    externalId: keyFingerprint(clientKey),
                    userId,
                },
                details: { name: 'Clyde' },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const clientKey = api.clientKey || api.username;
            if (!clientKey) {
                throw new Error(
                    'Clyde: cannot derive a stable credential identity — no clientKey to fingerprint.'
                );
            }
            return {
                identifiers: {
                    externalId: keyFingerprint(clientKey),
                    userId,
                },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['clientKey', 'secret'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            // Any authenticated list call proves the keys work.
            return api.getProducts({ page: 1 });
        },
    },
    env: {
        clientKey: process.env.CLYDE_CLIENT_KEY,
        secret: process.env.CLYDE_SECRET,
        baseUrl: process.env.CLYDE_API_BASE_URL,
    },
};

module.exports = { Definition };
