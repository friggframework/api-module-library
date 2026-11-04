require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * DonorPerfect Online is API-key authenticated. There is no OAuth flow and no
 * dedicated identity endpoint on the public XML API, so entity/credential
 * externalId is an MD5 hash of the key exactly as stored (keys contain
 * %2f/%2b; hashing a decoded variant would make connect and reload disagree).
 * Each DPO database has its own key, so the hash also separates tenants.
 */
function hashApiKey(apiKey) {
    return crypto.createHash('md5').update(String(apiKey)).digest('hex');
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Donorperfect',
    // ADR-057: donor → Contact / Company (org_rec='Y'). Gift has no genuine
    // fit in business@1 Deal / support@1 / billing@1 — see PR notes.
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: () => {
            const api = new Api({});
            return api.getAuthorizationRequirements();
        },
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params?.data || {}, 'api_key', null);
            if (!apiKey) throw new Error('API key is required');
            api.setApiKey(apiKey);
            return { api_key: apiKey };
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const raw =
                tokenResponse?.api_key || api.api_key || api.rawApiKey;
            if (!raw) {
                throw new Error(
                    'DonorPerfect: cannot derive a stable account identity — no API key to fingerprint.'
                );
            }
            return {
                identifiers: { externalId: hashApiKey(raw), userId },
                details: { name: 'DonorPerfect Online Account' },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const raw = api.api_key || api.rawApiKey;
            if (!raw) {
                throw new Error(
                    'DonorPerfect: cannot derive a stable credential identity — no API key to fingerprint.'
                );
            }
            return {
                identifiers: { externalId: hashApiKey(raw), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        // DP answers a bad key with HTTP 200 + success='false', so the result
        // is turned into a thrown friendly error. Never echo the key or DP's
        // raw reason text.
        testAuthRequest: async (api) => {
            let result;
            try {
                result = await api.testAuthRequest();
            } catch (error) {
                throw new Error(
                    'Unable to reach DonorPerfect to validate the API key'
                );
            }
            if (result && result.success === false) {
                const reason = String(result.reason || '').toLowerCase();
                if (reason.includes('invalid token')) {
                    throw new Error(
                        'The DonorPerfect API key is invalid or has been revoked. Verify the key and reconnect.'
                    );
                }
                if (reason.includes('login failed')) {
                    throw new Error(
                        'The DonorPerfect API key is missing or could not be validated. Verify the key and reconnect.'
                    );
                }
                throw new Error(
                    'DonorPerfect rejected the API key. Verify the key and reconnect.'
                );
            }
            return true;
        },
    },
    env: {
        api_key: process.env.DONORPERFECT_API_KEY,
        base_url: process.env.DONORPERFECT_BASE_URL,
    },
};

module.exports = { Definition, hashApiKey };
