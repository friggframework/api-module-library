require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Left Hook Core API is API-key authenticated (Bearer). There is no dedicated
 * public "/me" identity endpoint beyond `/v1/auth/verify`, so identity is a
 * stable sha256 fingerprint of the API key — non-reversible and unique per
 * credential (same pattern as fathom/gong/otter when no account id is available).
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'Left Hook API: cannot derive a stable account identity — no API key to fingerprint.'
        );
    }
    // Prefer a successful verify when available; identity still comes from the
    // key fingerprint because verify does not return a documented account id.
    try {
        await api.verifyAuth();
    } catch (e) {
        // Fingerprint is still valid for persistence; callers that need a live
        // auth check should use testAuthRequest.
    }
    return { externalId: keyFingerprint(apiKey), name: 'Left Hook API' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'LefthookApi',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => {
            const api = new Api();
            return api.getAuthorizationRequirements();
        },
        setAuthParams: async (api, params) => {
            const raw =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params, 'apiKey', null);
            if (raw) {
                api.setApiKey(String(raw).replace(/^Bearer\s+/i, '').trim());
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
            return api.verifyAuth();
        },
    },
    env: {
        api_key: process.env.LEFTHOOK_API_KEY,
    },
};

module.exports = { Definition };
