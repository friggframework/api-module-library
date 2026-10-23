require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Planhat Private Apps issue a static API Access Token (Bearer). There is no
 * dedicated "/me" or tenant-identity endpoint on the public REST API documented
 * at https://www.planhat.com/developers/api/.
 *
 * Identity strategy:
 *   1. Prefer the first active user from GET /users (email as externalId,
 *      nickName/name as display name) — a stable tenant-ish signal when the
 *      Private App can list users.
 *   2. Otherwise fall back to a sha256 fingerprint of the API token — stable,
 *      non-reversible, per-credential. Mirrors fathom/otter/gong.
 *
 * There is deliberately NO shared constant fallback: two different customers
 * must never map to the same entity/credential.
 */
const keyFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const users = await api.listUsers({ limit: 1 });
        const first = Array.isArray(users) ? users[0] : null;
        if (first?.email) {
            return {
                externalId: first.email,
                name:
                    first.nickName ||
                    [first.firstName, first.lastName].filter(Boolean).join(' ') ||
                    first.email,
            };
        }
    } catch (e) {
        // fall through to the per-credential key fingerprint
    }

    const token = api?.api_token;
    if (!token) {
        throw new Error(
            'Planhat: cannot derive a stable account identity — no user email and no API token to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(token), name: 'Planhat' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Planhat',
    // ADR-057: point at extensions.mapping (business@1 + accountHealth@1, UNVALIDATED).
    mappings: {
        business: 'extensions.mapping',
        accountHealth: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const raw =
                get(params, 'api_token', null) ||
                get(params, 'access_token', null) ||
                get(params, 'api_key', null);
            api.setApiToken(raw);
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
            credential: ['api_token'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            // Any authenticated call proves the token works.
            return api.listUsers({ limit: 1 });
        },
    },
    env: {
        api_token: process.env.PLANHAT_API_TOKEN,
    },
};

module.exports = { Definition };
