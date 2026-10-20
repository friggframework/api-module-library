require('dotenv').config();
const crypto = require('crypto');
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

// Quo (OpenPhone) authenticates with a single static API key and returns no
// stable account/workspace id at auth time. We derive a stable, non-reversible
// identifier from the API key itself (mirroring the gong/otter modules) so the
// same credential always maps to the same entity/credential. A phone-number id
// is NOT stable — reordering or deleting a number would change it and fork a new
// entity on re-auth — and a shared constant collides across accounts, so
// neither is acceptable as the externalId.
const keyFingerprint = (apiKey) => {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error(
            'Quo: cannot derive a stable externalId — no API key present on the api instance.'
        );
    }
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Quo',
    requiredAuthMethods: {
        // API-key module: render an interactive form (CLI + hosted UI)
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Quo API Authorization',
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
                            'Your Quo (OpenPhone) API key from Settings → API. Sent raw in the Authorization header (no Bearer prefix).',
                        'ui:placeholder': 'API Key',
                    },
                },
            },
        }),

        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
        },

        // Any authenticated call verifies the key. listPhoneNumbers is cheap
        // and always available on a valid workspace token.
        testAuthRequest: async (api) => api.listPhoneNumbers(),

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            // externalId is a stable sha256 fingerprint of the API key — unique
            // per credential and unchanged across phone-number churn. The
            // workspace's first phone number is still used only for a friendly
            // display name (best-effort), never for identity.
            const externalId = keyFingerprint(api.api_key);
            let name = 'Quo Workspace';
            try {
                const phoneNumbers = await api.listPhoneNumbers();
                const first = get(phoneNumbers, 'data', [])[0] || {};
                name = first.name || first.number || name;
            } catch (e) {
                // Display name is non-critical; identity does not depend on it.
            }
            return {
                identifiers: { externalId, user: userId },
                details: { name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const externalId = keyFingerprint(api.api_key);
            return {
                identifiers: { externalId, user: userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // ApiKeyRequester stores the key; persist it as access_token so the
            // Api constructor rehydrates it on the next instantiation.
            credential: ['access_token', 'api_key'],
            entity: [],
        },
    },
    env: {
        api_key: process.env.QUO_API_KEY,
        base_url: process.env.QUO_BASE_URL,
    },
};

module.exports = { Definition };
