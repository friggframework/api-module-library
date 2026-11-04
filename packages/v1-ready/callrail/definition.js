require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * CallRail is API-key authenticated (`Authorization: Token token="..."`).
 * There is no OAuth flow for the v3 REST API. Identity is the first account
 * returned by GET /v3/a.json when available; otherwise a sha256 fingerprint
 * of the API key (stable, non-reversible, per-credential).
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.listAccounts({});
        const first = Array.isArray(result?.accounts)
            ? result.accounts[0]
            : null;
        if (first?.id) {
            return {
                externalId: String(first.id),
                name: first.name || String(first.id),
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'CallRail: cannot derive a stable account identity — no account from listAccounts and no API key to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(apiKey), name: 'CallRail' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'CallRail',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'CallRail Authentication',
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
                            'Create an API key in CallRail under Integrations → API Keys. Sent as Authorization: Token token="<key>".',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            api.setApiKey(apiKey);
            const requestFrom = get(params, 'request_from', null);
            if (requestFrom) {
                api.request_from = requestFrom;
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
            return api.listAccounts({});
        },
    },
    env: {
        api_key: process.env.CALLRAIL_API_KEY,
    },
};

module.exports = { Definition };
