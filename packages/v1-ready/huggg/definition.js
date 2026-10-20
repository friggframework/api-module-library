require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Huggg is API-key authenticated (X-Huggg-API-Key). There is no documented
 * "/me" identity endpoint on the public docs site, so identity is a sha256
 * fingerprint of the API key — stable, non-reversible, and unique per credential.
 * This mirrors the fathom/gong/otter modules.
 *
 * OAuth password grant remains available on Api for adopters who still receive
 * client_id/secret/username/password from Huggg; the Definition wires API-key.
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

function resolveAccountIdentity(api) {
    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'Huggg: cannot derive a stable account identity — no API key to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(apiKey), name: 'Huggg' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Huggg',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Huggg Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'API key issued by Huggg for a specific user within a team. Sent as the X-Huggg-API-Key header on every request. See https://docs.huggg.me/endpoints/authentication/api-keys/overview/',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'data.api_key', null) ||
                get(params, 'apiKey', null);
            if (apiKey) {
                api.api_key = apiKey;
                if (typeof api.setApiKey === 'function') {
                    api.setApiKey(apiKey);
                }
            }
            const isSandbox =
                get(params, 'isSandbox', null) ??
                get(params, 'data.isSandbox', null);
            if (isSandbox === true || isSandbox === 'true') {
                api.isSandbox = true;
                api.baseUrl = 'https://beta.api.huggg.me';
                api.tokenUri = `${api.baseUrl}/oauth/token`;
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            // Any authenticated catalogue call proves the key works.
            return api.listProducts({ 'pagination-limit': 1 });
        },
    },
    env: {
        api_key: process.env.HUGGG_API_KEY,
        base_url: process.env.HUGGG_BASE_URL,
    },
};

module.exports = { Definition };
