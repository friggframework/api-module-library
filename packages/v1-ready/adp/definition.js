require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * ADP Workforce Now uses OAuth 2.0 client credentials + mutual TLS (no browser
 * redirect). There is no public "/me" identity endpoint on the Worker
 * Management API, so the Frigg entity externalId is the OAuth `client_id`
 * supplied at auth time — stable per Data Connector credential.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Adp',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) ||
                get(params, 'clientId', null) ||
                get(data, 'client_id', null) ||
                get(data, 'clientId', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(params, 'clientSecret', null) ||
                get(data, 'client_secret', null) ||
                get(data, 'clientSecret', null);
            const sslCert =
                get(params, 'ssl_cert', null) ||
                get(params, 'sslCert', null) ||
                get(data, 'ssl_cert', null) ||
                get(data, 'sslCert', null);
            const sslKey =
                get(params, 'ssl_key', null) ||
                get(params, 'sslKey', null) ||
                get(data, 'ssl_key', null) ||
                get(data, 'sslKey', null);
            const sslPassphrase =
                get(params, 'ssl_passphrase', null) ||
                get(params, 'sslPassphrase', null) ||
                get(data, 'ssl_passphrase', null) ||
                get(data, 'sslPassphrase', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (sslCert) api.ssl_cert = sslCert;
            if (sslKey) api.ssl_key = sslKey;
            if (sslPassphrase !== undefined && sslPassphrase !== null) {
                api.ssl_passphrase = sslPassphrase;
            }
            api._configureTlsAgent();
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const clientId = api.client_id;
            if (!clientId) {
                throw new Error(
                    'ADP: client_id is required to derive a stable account identity for entity routing.'
                );
            }
            return {
                identifiers: { externalId: String(clientId), userId },
                details: { name: `ADP ${clientId}` },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const clientId = api.client_id;
            if (!clientId) {
                throw new Error(
                    'ADP: client_id is required to derive a stable credential identity.'
                );
            }
            return {
                identifiers: { externalId: String(clientId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'client_id',
                'client_secret',
                'access_token',
                'accessTokenExpire',
                'ssl_cert',
                'ssl_key',
                'ssl_passphrase',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        client_id: process.env.ADP_CLIENT_ID,
        client_secret: process.env.ADP_CLIENT_SECRET,
        // UPPER_SNAKE keys match schema patternProperties; PEMs are applied
        // via setAuthParams / credential hydrate (not auto-bound by core).
        SSL_CERT: process.env.ADP_SSL_CERT,
        SSL_KEY: process.env.ADP_SSL_KEY,
        SSL_PASSPHRASE: process.env.ADP_SSL_PASSPHRASE,
    },
    encryption: {
        credentialFields: [
            'client_secret',
            'access_token',
            'ssl_key',
            'ssl_passphrase',
        ],
    },
};

module.exports = { Definition };
