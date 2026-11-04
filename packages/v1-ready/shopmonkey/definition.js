require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Shopmonkey is API-key authenticated (`Authorization: Bearer <key>`).
 * Keys are created in Settings → Integration → API Keys (not via the API —
 * API keys cannot create other API keys). Identity comes from GET /user/me;
 * if that fails, fall back to a sha256 fingerprint of the API key.
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.getCurrentUser();
        const user = result?.data || result;
        if (user?.id) {
            const name =
                user.company?.name ||
                user.location?.name ||
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                user.email ||
                String(user.id);
            return {
                externalId: String(user.id),
                name,
                companyId: user.companyId ? String(user.companyId) : undefined,
                email: user.email,
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'Shopmonkey: cannot derive a stable account identity — no user from getCurrentUser and no API key to fingerprint.'
        );
    }
    const bare = String(apiKey).replace(/^Bearer\s+/i, '').trim();
    return { externalId: keyFingerprint(bare), name: 'Shopmonkey' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Shopmonkey',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Shopmonkey Authentication',
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
                            'Create an API key in Shopmonkey under Settings → Integration → API Keys. Sent as Authorization: Bearer <key>.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            api.setApiKey(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    companyId: identity.companyId,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
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
            return api.getApiKeyStatus();
        },
    },
    env: {
        api_key: process.env.SHOPMONKEY_API_KEY,
    },
};

module.exports = { Definition };
