require('dotenv').config();
const crypto = require('crypto');
const { Api, DEFAULT_BASE_URL } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * ChurnZero uses HTTP Basic (username + API key). There is no dedicated
 * tenant identity endpoint on the public REST OpenAPI, so we prefer the first
 * UserAccount email when available and otherwise fingerprint
 * username|baseUrl|api_key — stable and unique per credential set.
 */
const credentialFingerprint = (api) =>
    crypto
        .createHash('sha256')
        .update(
            [
                api?.username || '',
                api?.baseUrl || '',
                api?.api_key || api?.password || '',
            ].join('|')
        )
        .digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.listUserAccounts({ top: 1 });
        const rows = Array.isArray(result?.value) ? result.value : [];
        const first = rows[0];
        if (first?.Email) {
            return {
                externalId: first.Email,
                name: first.Name || first.Email,
            };
        }
        if (first?.Id != null) {
            return {
                externalId: String(first.Id),
                name: first.Name || `ChurnZero user ${first.Id}`,
            };
        }
    } catch (e) {
        // fall through to fingerprint
    }

    const username = api?.username;
    const apiKey = api?.api_key || api?.password;
    if (!username && !apiKey) {
        throw new Error(
            'ChurnZero: cannot derive a stable account identity — no UserAccount identity and no credentials to fingerprint.'
        );
    }
    return {
        externalId: credentialFingerprint(api),
        name: 'ChurnZero',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ChurnZero',
    mappings: {
        business: 'extensions.mapping',
        accountHealth: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const username =
                get(params, 'username', null) || get(data, 'username', null);
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'password', null) ||
                get(data, 'password', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(data, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(data, 'baseUrl', null);

            if (username) api.username = username;
            if (apiKey) {
                api.api_key = apiKey;
                api.password = apiKey;
            }
            if (baseUrl) {
                const normalized = String(baseUrl).replace(/\/+$/, '');
                api.base_url = normalized;
                api.baseUrl = normalized;
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
            credential: ['username', 'api_key', 'base_url'],
            entity: [],
        },

        testAuthRequest: async (api) => api.testAuth(),
    },
    env: {
        username: process.env.CHURNZERO_USERNAME,
        api_key: process.env.CHURNZERO_API_KEY,
        base_url: process.env.CHURNZERO_BASE_URL || DEFAULT_BASE_URL,
    },
};

module.exports = { Definition };
