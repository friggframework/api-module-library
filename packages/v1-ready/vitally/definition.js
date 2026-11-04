require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Vitally issues a static REST API key (Basic auth, empty password), so there
 * is no external account id returned at auth time. We derive a stable,
 * non-reversible identifier from the API key (+ subdomain when present) so the
 * same credentials always map to the same entity/credential.
 */
const keyFingerprint = (apiKey, subdomain) =>
    crypto
        .createHash('sha256')
        .update(`${String(apiKey)}:${String(subdomain || '')}`)
        .digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Vitally',
    // ADR-057: mappings live on extensions.mapping (see index.js).
    mappings: {
        business: 'extensions.mapping',
        AccountHealth: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params, 'apiKey', null) ||
                get(data, 'api_key', null) ||
                get(data, 'access_token', null) ||
                get(data, 'apiKey', null);

            if (apiKey) {
                api.setApiKey(apiKey);
            }

            const subdomain =
                get(params, 'subdomain', null) || get(data, 'subdomain', null);
            if (subdomain) {
                api.setSubdomain(subdomain);
            }

            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            if (baseUrl) {
                api.setBaseUrl(baseUrl);
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
                    externalId: keyFingerprint(
                        api.api_key || api.username,
                        api.subdomain
                    ),
                    userId,
                },
                details: {
                    subdomain: api.subdomain || undefined,
                    baseUrl: api.baseUrl || undefined,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'subdomain', 'base_url'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {
                    externalId: keyFingerprint(
                        api.api_key || api.username,
                        api.subdomain
                    ),
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
        api_key: process.env.VITALLY_API_KEY,
        subdomain: process.env.VITALLY_SUBDOMAIN,
        base_url: process.env.VITALLY_BASE_URL,
    },
};

module.exports = { Definition };
