require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Instantly is API-key authenticated (Authorization: Bearer <key>).
 * Identity comes from GET /workspaces/current when the key has workspaces:read.
 *
 * When that call fails (missing scope, network, empty response without id) we
 * fall back to a sha256 fingerprint of the API key — a stable, non-reversible,
 * per-credential identifier. There is deliberately NO shared constant fallback:
 * two different customers must never map to the same entity/credential.
 *
 * Note: Instantly's documented "OAuth connection flow" connects Google/Microsoft
 * *sending accounts into an Instantly workspace*. It is not the auth method for
 * this API module, so no INSTANTLY_REDIRECT_URI is required.
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const workspace = await api.getWorkspace();
        if (workspace?.id) {
            return {
                externalId: workspace.id,
                name: workspace.name || workspace.id,
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'Instantly: cannot derive a stable account identity — no workspace id and no API key to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(apiKey), name: 'Instantly' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Instantly',
    // ADR-057: mappings live on extensions.mapping (see index.js).
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
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
            return api;
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
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.INSTANTLY_API_KEY,
    },
};

module.exports = { Definition };
