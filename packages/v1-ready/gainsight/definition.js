require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Gainsight CS authenticates with a static Access Key (`accesskey` header).
 * There is no dedicated identity /me endpoint on the public REST surface, so
 * entity/credential identity is a sha256 fingerprint of
 * `${baseUrl}|${accessKey}` — stable per tenant+key and unique across accounts.
 */
const keyFingerprint = (baseUrl, apiKey) =>
    crypto
        .createHash('sha256')
        .update(`${String(baseUrl || '')}|${String(apiKey || '')}`)
        .digest('hex');

async function resolveAccountIdentity(api) {
    const apiKey = api?.api_key;
    const baseUrl = api?.baseUrl;
    if (!apiKey) {
        throw new Error(
            'Gainsight: cannot derive a stable account identity — no access key to fingerprint.'
        );
    }
    return {
        externalId: keyFingerprint(baseUrl, apiKey),
        name: baseUrl || 'Gainsight',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Gainsight',
    // ADR-057: business@1 Company/Contact + AccountHealth (sameAs-only); UNVALIDATED.
    mappings: {
        business: 'extensions.mapping',
        AccountHealth: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Gainsight CS Authentication',
                    type: 'object',
                    required: ['access_key', 'base_url'],
                    properties: {
                        access_key: {
                            type: 'string',
                            title: 'Access Key',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Customer Domain',
                            description:
                                'Gainsight tenant URL, e.g. https://acme.gainsightcloud.com (no trailing slash)',
                        },
                    },
                },
                uiSchema: {
                    access_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Administration > Connectors 2.0 > Gainsight API > Access_Key. Sent as the accesskey header.',
                    },
                    base_url: {
                        'ui:help':
                            'Your Gainsight customer domain used as the API host for /v1 and /v2 paths.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const accessKey =
                get(params, 'access_key', null) ||
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(data, 'access_key', null) ||
                get(data, 'api_key', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(data, 'base_url', null) ||
                get(data, 'baseUrl', null);
            if (accessKey) {
                api.setApiKey(accessKey);
            }
            if (baseUrl) {
                api.setBaseUrl(baseUrl);
            }
            return api;
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name, baseUrl: api.baseUrl },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { baseUrl: api.baseUrl },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'baseUrl'],
            entity: ['baseUrl'],
        },
        testAuthRequest: async (api) => {
            // Lightweight authenticated metadata call.
            return api.listObjects({});
        },
    },
    env: {
        api_key: process.env.GAINSIGHT_ACCESS_KEY,
        base_url: process.env.GAINSIGHT_BASE_URL,
    },
};

module.exports = { Definition };
